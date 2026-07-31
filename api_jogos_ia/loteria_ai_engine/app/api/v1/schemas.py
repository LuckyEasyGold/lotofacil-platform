"""
Pydantic Schemas for API Request/Response Validation
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime


class SeedResponse(BaseModel):
    """Response schema for GET /seed endpoint"""
    version: str
    game_type: str
    weights: List[float]
    correlations: Optional[List[List[float]]] = None
    filters: Dict[str, Any]
    generated_at: datetime


class HistoricalResultCreate(BaseModel):
    """Schema for creating a new historical result"""
    game_type: str
    contest_number: int
    draw_date: datetime
    numbers: List[int]


class HistoricalResultResponse(HistoricalResultCreate):
    """Response schema for historical results"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    """Response schema for GET /stats endpoint"""
    game_type: str
    current_generation: int
    best_fitness_score: float
    total_results_analyzed: int
    last_update: datetime
    evolution_rate: float  # Generations per hour


class GenerationDataPoint(BaseModel):
    """Single data point for evolution visualization"""
    generation: int
    best_fitness: float
    avg_fitness: Optional[float] = None
    population_diversity: Optional[float] = None
    timestamp: datetime


class EvolutionHistoryResponse(BaseModel):
    """Response for evolution history visualization"""
    game_type: str
    total_generations: int
    data_points: List[GenerationDataPoint]
