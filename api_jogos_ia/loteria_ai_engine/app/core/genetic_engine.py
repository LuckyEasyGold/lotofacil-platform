"""
Genetic Algorithm Core Implementation for Loteria AI Engine
"""
import numpy as np
import random
from typing import List, Dict, Tuple, Any
from deap import base, creator, tools, algorithms
import json


class LotteryGeneticEngine:
    """
    Genetic Algorithm engine for evolving lottery seeds.
    Each individual represents a "seed" with weights and correlation matrices.
    """

    def __init__(self, game_type: str, num_numbers: int, numbers_to_pick: int):
        self.game_type = game_type
        self.num_numbers = num_numbers  # e.g., 25 for Lotofacil
        self.numbers_to_pick = numbers_to_pick  # e.g., 15 for Lotofacil
        
        # Setup DEAP framework
        self._setup_deap()
        
        # Historical data for fitness evaluation
        self.historical_results: List[List[int]] = []
        
        # Current best seed
        self.best_individual = None
        self.best_fitness = 0.0
        self.current_generation = 0
        
        # Evolution statistics for visualization
        self.generation_history: List[Dict[str, Any]] = []

    def _setup_deap(self):
        """Setup DEAP creator and toolbox"""
        # Create fitness and individual classes
        try:
            creator.create("FitnessMax", base.Fitness, weights=(1.0,))
            creator.create("Individual", list, fitness=creator.FitnessMax)
        except AttributeError:
            # Already created
            pass
        
        self.toolbox = base.Toolbox()
        
        # Attribute generator: weights for each number (0.0 to 1.0)
        self.toolbox.register("attr_float", random.random)
        
        # Structure initializers
        self.toolbox.register(
            "individual",
            tools.initRepeat,
            creator.Individual,
            self.toolbox.attr_float,
            self.num_numbers
        )
        
        # Population initializer
        self.toolbox.register(
            "population",
            tools.initRepeat,
            list,
            self.toolbox.individual
        )
        
        # Operators
        self.toolbox.register("evaluate", self._fitness_function)
        self.toolbox.register("mate", tools.cxBlend, alpha=0.5)
        self.toolbox.register("mutate", tools.mutGaussian, mu=0, sigma=0.1, indpb=0.1)
        self.toolbox.register("select", tools.selTournament, tournsize=3)

    def load_historical_data(self, results: List[List[int]]):
        """Load historical results for fitness evaluation"""
        self.historical_results = results

    def _fitness_function(self, individual: List[float]) -> Tuple[float]:
        """
        Evaluate the fitness of an individual (seed).
        Simulates games and compares against historical results.
        """
        weights = np.array(individual)
        weights = weights / weights.sum()  # Normalize
        
        # Generate correlation matrix based on individual
        correlation_matrix = self._generate_correlation_matrix(individual)
        
        # Simulate games
        simulated_games = self._simulate_games(weights, correlation_matrix, n_games=1000)
        
        # Score against historical results
        score = self._score_against_history(simulated_games)
        
        return (score,)

    def _generate_correlation_matrix(self, individual: List[float]) -> np.ndarray:
        """Generate a correlation matrix based on the individual's genome"""
        # Simplified: create correlations based on number proximity and weights
        matrix = np.zeros((self.num_numbers, self.num_numbers))
        for i in range(self.num_numbers):
            for j in range(self.num_numbers):
                if i != j:
                    # Higher correlation for nearby numbers
                    distance = abs(i - j)
                    base_corr = max(0, 1.0 - distance / 10.0)
                    weight_factor = (individual[i] + individual[j]) / 2.0
                    matrix[i, j] = base_corr * weight_factor
        return matrix

    def _simulate_games(self, weights: np.ndarray, 
                       correlation_matrix: np.ndarray, 
                       n_games: int = 1000) -> List[List[int]]:
        """Simulate lottery games based on weights and correlations"""
        games = []
        for _ in range(n_games):
            # Adjust probabilities based on correlations (simplified)
            probs = weights.copy()
            
            # Select numbers without replacement
            selected = []
            available_probs = probs.copy()
            
            for _ in range(self.numbers_to_pick):
                # Normalize remaining probabilities
                available_probs = available_probs / available_probs.sum()
                
                # Select number based on probability
                chosen = np.random.choice(
                    self.num_numbers, 
                    p=available_probs
                )
                selected.append(chosen + 1)  # 1-indexed
                
                # Remove chosen number
                available_probs[chosen] = 0
            
            games.append(sorted(selected))
        
        return games

    def _score_against_history(self, simulated_games: List[List[int]]) -> float:
        """
        Score simulated games against historical results.
        Rewards matches of partial results (quadras, quinas, etc.)
        """
        if not self.historical_results:
            return 0.0
        
        total_score = 0.0
        n_comparisons = min(len(simulated_games), len(self.historical_results) * 10)
        
        for sim_game in simulated_games[:n_comparisons]:
            sim_set = set(sim_game)
            
            # Compare with multiple historical results
            for hist_result in self.historical_results[-100:]:  # Last 100 results
                hist_set = set(hist_result)
                matches = len(sim_set.intersection(hist_set))
                
                # Scoring: exponential reward for more matches
                if matches >= self.numbers_to_pick - 2:  # Near win
                    total_score += 1000.0
                elif matches >= self.numbers_to_pick - 3:
                    total_score += 100.0
                elif matches >= self.numbers_to_pick - 4:
                    total_score += 10.0
                elif matches >= self.numbers_to_pick // 2:
                    total_score += 1.0
        
        return total_score / n_comparisons

    def evolve(self, population_size: int = 100, generations: int = 50, 
               checkpoint_callback=None) -> Dict[str, Any]:
        """
        Run the evolutionary algorithm.
        Returns the best seed found.
        """
        population = self.toolbox.population(n=population_size)
        
        # Statistics setup
        stats = tools.Statistics(lambda ind: ind.fitness.values[0])
        stats.register("avg", np.mean)
        stats.register("max", np.max)
        
        # Hall of Fame
        hof = tools.HallOfFame(1)
        
        # Evolve
        population, logbook = algorithms.eaSimple(
            population,
            self.toolbox,
            cxpb=0.7,
            mutpb=0.2,
            ngen=generations,
            stats=stats,
            halloffame=hof,
            verbose=False
        )
        
        # Update best
        self.best_individual = hof[0]
        self.best_fitness = hof[0].fitness.values[0]
        self.current_generation += generations
        
        # Record history for visualization
        for record in logbook:
            self.generation_history.append({
                "generation": self.current_generation - generations + record['gen'],
                "best_fitness": record['max'],
                "avg_fitness": record['avg'],
                "timestamp": datetime.now()
            })
        
        # Callback for checkpointing
        if checkpoint_callback:
            checkpoint_callback(self.get_seed_data())
        
        return self.get_seed_data()

    def get_seed_data(self) -> Dict[str, Any]:
        """Convert current best individual to seed data format"""
        if self.best_individual is None:
            # Return random seed if no evolution yet
            weights = [random.random() for _ in range(self.num_numbers)]
        else:
            weights = list(self.best_individual)
        
        # Normalize weights
        weights = [w / sum(weights) for w in weights]
        
        return {
            "version": f"1.0.{self.current_generation}",
            "game_type": self.game_type,
            "weights": weights,
            "correlations": self._generate_correlation_matrix(
                self.best_individual if self.best_individual else weights
            ).tolist() if self.best_individual else None,
            "filters": {
                "min_evens": self.numbers_to_pick // 2 - 2,
                "max_evens": self.numbers_to_pick // 2 + 2,
                "min_sum": self.numbers_to_pick * (self.num_numbers // 4),
                "max_sum": self.numbers_to_pick * (self.num_numbers * 3 // 4)
            },
            "generation": self.current_generation,
            "fitness_score": self.best_fitness
        }

    def generate_game_from_seed(self, seed_data: Dict[str, Any]) -> List[int]:
        """Generate a single game using the seed data"""
        weights = np.array(seed_data["weights"])
        
        # Select numbers based on weights
        selected = []
        available_probs = weights.copy()
        
        for _ in range(self.numbers_to_pick):
            available_probs = available_probs / available_probs.sum()
            chosen = np.random.choice(self.num_numbers, p=available_probs)
            selected.append(chosen + 1)  # 1-indexed
            available_probs[chosen] = 0
        
        return sorted(selected)


# Import datetime for generation history
from datetime import datetime
