"""
Service layer for managing evolution and database operations
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

from app.models.models import (
    HistoricalResult, 
    EvolutionState, 
    GenerationHistory,
    APILog
)
from app.core.genetic_engine import LotteryGeneticEngine


class EvolutionService:
    """Service for managing the genetic algorithm evolution"""
    
    # Game configurations
    GAME_CONFIGS = {
        "LOTOFACIL": {"num_numbers": 25, "numbers_to_pick": 15},
        "MEGASENA": {"num_numbers": 60, "numbers_to_pick": 6},
        "QUINA": {"num_numbers": 80, "numbers_to_pick": 5},
        "LOTOMANIA": {"num_numbers": 100, "numbers_to_pick": 20}
    }
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.engines: Dict[str, LotteryGeneticEngine] = {}
        
    def get_or_create_engine(self, game_type: str) -> LotteryGeneticEngine:
        """Get or create a genetic engine for a specific game type"""
        if game_type not in self.GAME_CONFIGS:
            raise ValueError(f"Unsupported game type: {game_type}")
        
        if game_type not in self.engines:
            config = self.GAME_CONFIGS[game_type]
            engine = LotteryGeneticEngine(
                game_type=game_type,
                num_numbers=config["num_numbers"],
                numbers_to_pick=config["numbers_to_pick"]
            )
            
            # Load historical data
            self._load_historical_data(engine, game_type)
            
            # Load existing state if available
            self._load_evolution_state(engine, game_type)
            
            self.engines[game_type] = engine
        
        return self.engines[game_type]
    
    def _load_historical_data(self, engine: LotteryGeneticEngine, game_type: str):
        """Load historical results from database"""
        results = self.db.query(HistoricalResult).filter(
            HistoricalResult.game_type == game_type
        ).order_by(HistoricalResult.contest_number.asc()).all()
        
        engine.load_historical_data([r.numbers for r in results])
    
    def _load_evolution_state(self, engine: LotteryGeneticEngine, game_type: str):
        """Load existing evolution state from database"""
        state = self.db.query(EvolutionState).filter(
            EvolutionState.game_type == game_type
        ).first()
        
        if state and state.seed_data:
            # Restore engine state from database
            engine.best_fitness = state.fitness_score
            engine.current_generation = state.generation_count
    
    def run_evolution_cycle(self, game_type: str, generations: int = 10) -> Dict[str, Any]:
        """Run a cycle of evolution for a specific game type"""
        engine = self.get_or_create_engine(game_type)
        
        def checkpoint_callback(seed_data: Dict[str, Any]):
            """Save checkpoint to database"""
            self._save_evolution_state(game_type, seed_data)
        
        result = engine.evolve(
            population_size=100,
            generations=generations,
            checkpoint_callback=checkpoint_callback
        )
        
        return result
    
    def _save_evolution_state(self, game_type: str, seed_data: Dict[str, Any]):
        """Save evolution state to database"""
        # Check if state exists
        existing = self.db.query(EvolutionState).filter(
            EvolutionState.game_type == game_type
        ).first()
        
        if existing:
            # Update existing
            existing.seed_data = seed_data
            existing.fitness_score = seed_data.get("fitness_score", 0.0)
            existing.generation_count = seed_data.get("generation", 0)
        else:
            # Create new
            new_state = EvolutionState(
                game_type=game_type,
                seed_data=seed_data,
                fitness_score=seed_data.get("fitness_score", 0.0),
                generation_count=seed_data.get("generation", 0)
            )
            self.db.add(new_state)
        
        # Save generation history for visualization
        gen_history = GenerationHistory(
            game_type=game_type,
            generation=seed_data.get("generation", 0),
            best_fitness=seed_data.get("fitness_score", 0.0)
        )
        self.db.add(gen_history)
        
        self.db.commit()
    
    def get_current_seed(self, game_type: str) -> Optional[Dict[str, Any]]:
        """Get the current best seed for a game type"""
        state = self.db.query(EvolutionState).filter(
            EvolutionState.game_type == game_type
        ).order_by(EvolutionState.updated_at.desc()).first()
        
        if state:
            return state.seed_data
        return None
    
    def add_historical_result(self, game_type: str, contest_number: int, 
                             draw_date: datetime, numbers: List[int]) -> HistoricalResult:
        """Add a new historical result"""
        result = HistoricalResult(
            game_type=game_type,
            contest_number=contest_number,
            draw_date=draw_date,
            numbers=numbers
        )
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        
        # Update engine with new data
        if game_type in self.engines:
            self._load_historical_data(self.engines[game_type], game_type)
        
        return result
    
    def get_evolution_history(self, game_type: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get evolution history for visualization"""
        history = self.db.query(GenerationHistory).filter(
            GenerationHistory.game_type == game_type
        ).order_by(GenerationHistory.generation.asc()).limit(limit).all()
        
        return [
            {
                "generation": h.generation,
                "best_fitness": h.best_fitness,
                "avg_fitness": h.avg_fitness,
                "population_diversity": h.population_diversity,
                "timestamp": h.timestamp.isoformat()
            }
            for h in history
        ]
    
    def get_stats(self, game_type: str) -> Dict[str, Any]:
        """Get statistics for a game type"""
        engine = self.get_or_create_engine(game_type)
        
        total_results = self.db.query(HistoricalResult).filter(
            HistoricalResult.game_type == game_type
        ).count()
        
        latest_state = self.db.query(EvolutionState).filter(
            EvolutionState.game_type == game_type
        ).order_by(EvolutionState.updated_at.desc()).first()
        
        return {
            "game_type": game_type,
            "current_generation": engine.current_generation,
            "best_fitness_score": engine.best_fitness,
            "total_results_analyzed": total_results,
            "last_update": latest_state.updated_at.isoformat() if latest_state else None,
            "evolution_rate": 0.0  # Would need timestamp tracking to calculate
        }
    
    def log_api_request(self, endpoint: str, response_time: float, 
                       status_code: int):
        """Log an API request"""
        log = APILog(
            endpoint=endpoint,
            response_time=response_time,
            status_code=status_code
        )
        self.db.add(log)
        self.db.commit()
