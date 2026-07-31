"""
API Routes for Loteria AI Engine
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
import time
from datetime import datetime

from app.db.database import get_db
from app.services.evolution_service import EvolutionService
from app.api.v1.schemas import (
    SeedResponse,
    HistoricalResultCreate,
    HistoricalResultResponse,
    StatsResponse,
    EvolutionHistoryResponse,
    GenerationDataPoint
)

router = APIRouter()


def get_evolution_service(db: Session = Depends(get_db)) -> EvolutionService:
    """Dependency to get evolution service"""
    return EvolutionService(db)


@router.get("/seed/{game_type}", response_model=SeedResponse, tags=["Seeds"])
async def get_seed(
    game_type: str,
    service: EvolutionService = Depends(get_evolution_service)
):
    """
    Get the current best seed for a specific game type.
    The mobile app uses this to generate games locally.
    """
    start_time = time.time()
    
    seed_data = service.get_current_seed(game_type)
    
    if not seed_data:
        # Run initial evolution if no seed exists
        seed_data = service.run_evolution_cycle(game_type, generations=20)
    
    response_time = time.time() - start_time
    service.log_api_request("/api/v1/seed/{game_type}", response_time, 200)
    
    return SeedResponse(
        version=seed_data.get("version", "1.0.0"),
        game_type=seed_data.get("game_type", game_type),
        weights=seed_data.get("weights", []),
        correlations=seed_data.get("correlations"),
        filters=seed_data.get("filters", {}),
        generated_at=datetime.now()
    )


@router.post("/results", response_model=HistoricalResultResponse, tags=["Results"])
async def add_result(
    result: HistoricalResultCreate,
    service: EvolutionService = Depends(get_evolution_service)
):
    """
    Add a new official lottery result.
    This triggers the evolution engine to update with new data.
    """
    start_time = time.time()
    
    try:
        new_result = service.add_historical_result(
            game_type=result.game_type,
            contest_number=result.contest_number,
            draw_date=result.draw_date,
            numbers=result.numbers
        )
        
        # Trigger evolution cycle with new data
        service.run_evolution_cycle(result.game_type, generations=10)
        
        response_time = time.time() - start_time
        service.log_api_request("/api/v1/results", response_time, 201)
        
        return HistoricalResultResponse(
            id=new_result.id,
            game_type=new_result.game_type,
            contest_number=new_result.contest_number,
            draw_date=new_result.draw_date,
            numbers=new_result.numbers,
            created_at=new_result.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats/{game_type}", response_model=StatsResponse, tags=["Statistics"])
async def get_stats(
    game_type: str,
    service: EvolutionService = Depends(get_evolution_service)
):
    """
    Get statistics about the AI evolution for a specific game type.
    """
    start_time = time.time()
    
    stats = service.get_stats(game_type)
    
    response_time = time.time() - start_time
    service.log_api_request("/api/v1/stats/{game_type}", response_time, 200)
    
    return StatsResponse(**stats)


@router.get("/evolution-history/{game_type}", 
            response_model=EvolutionHistoryResponse, 
            tags=["Visualization"])
async def get_evolution_history(
    game_type: str,
    limit: int = Query(default=100, ge=1, le=1000),
    service: EvolutionService = Depends(get_evolution_service)
):
    """
    Get evolution history for visualization.
    Returns data points showing fitness evolution over generations.
    """
    start_time = time.time()
    
    history_data = service.get_evolution_history(game_type, limit=limit)
    
    if not history_data:
        # Return empty structure if no data
        return EvolutionHistoryResponse(
            game_type=game_type,
            total_generations=0,
            data_points=[]
        )
    
    data_points = [
        GenerationDataPoint(
            generation=h["generation"],
            best_fitness=h["best_fitness"],
            avg_fitness=h.get("avg_fitness"),
            population_diversity=h.get("population_diversity"),
            timestamp=datetime.fromisoformat(h["timestamp"])
        )
        for h in history_data
    ]
    
    response_time = time.time() - start_time
    service.log_api_request("/api/v1/evolution-history/{game_type}", response_time, 200)
    
    return EvolutionHistoryResponse(
        game_type=game_type,
        total_generations=max(h["generation"] for h in history_data) if history_data else 0,
        data_points=data_points
    )


@router.get("/games/{game_type}", tags=["Games"])
async def generate_games(
    game_type: str,
    quantity: int = Query(default=1, ge=1, le=100),
    service: EvolutionService = Depends(get_evolution_service)
):
    """
    Generate lottery games using the current seed.
    Useful for testing or direct consumption.
    """
    start_time = time.time()
    
    seed_data = service.get_current_seed(game_type)
    
    if not seed_data:
        raise HTTPException(status_code=404, detail="No seed available. Run evolution first.")
    
    # Get engine to generate games
    engine = service.get_or_create_engine(game_type)
    
    games = []
    for _ in range(quantity):
        game = engine.generate_game_from_seed(seed_data)
        games.append(game)
    
    response_time = time.time() - start_time
    service.log_api_request("/api/v1/games/{game_type}", response_time, 200)
    
    return {
        "game_type": game_type,
        "seed_version": seed_data.get("version"),
        "games": games,
        "generated_at": datetime.now().isoformat()
    }
