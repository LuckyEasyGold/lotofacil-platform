"""
Main FastAPI Application for Loteria AI Engine
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import time
from contextlib import asynccontextmanager

from app.db.database import engine, Base
from app.api.v1.routes import router as api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")
    print("🚀 Loteria AI Engine started")
    yield
    # Shutdown
    print("🛑 Loteria AI Engine shutting down")


app = FastAPI(
    title="Loteria AI Engine",
    description="API de Inteligência Artificial para Loterias com Algoritmo Genético",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and templates for the visualization interface
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

# Include API routes
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main visualization interface"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Loteria AI Engine"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
