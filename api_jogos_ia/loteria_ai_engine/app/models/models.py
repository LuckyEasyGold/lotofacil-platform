"""
Database Models for Loteria AI Engine
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.database import Base


class HistoricalResult(Base):
    """Stores all official lottery results"""
    __tablename__ = "historical_results"

    id = Column(Integer, primary_key=True, index=True)
    game_type = Column(String(50), nullable=False, index=True)  # LOTOFACIL, MEGASENA, etc.
    contest_number = Column(Integer, nullable=False, index=True)
    draw_date = Column(DateTime, nullable=False)
    numbers = Column(ARRAY(Integer), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EvolutionState(Base):
    """Stores the current state of the AI evolution"""
    __tablename__ = "evolution_state"

    id = Column(Integer, primary_key=True, index=True)
    game_type = Column(String(50), nullable=False, index=True)
    seed_data = Column(JSONB, nullable=False)  # Weights, correlations, filters
    fitness_score = Column(Float, nullable=False)
    generation_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class APILog(Base):
    """API request logs for auditing and monitoring"""
    __tablename__ = "api_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String(255), nullable=False)
    response_time = Column(Float, nullable=True)
    status_code = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class GenerationHistory(Base):
    """Tracks evolution progress over time for visualization"""
    __tablename__ = "generation_history"

    id = Column(Integer, primary_key=True, index=True)
    game_type = Column(String(50), nullable=False, index=True)
    generation = Column(Integer, nullable=False)
    best_fitness = Column(Float, nullable=False)
    avg_fitness = Column(Float, nullable=True)
    population_diversity = Column(Float, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
