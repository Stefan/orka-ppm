"""
Local Embedding Service
Provides embeddings using sentence-transformers for offline/local usage
Alternative to OpenAI embeddings when USE_LOCAL_EMBEDDINGS=true
"""

import os
import logging
from typing import List
import numpy as np

logger = logging.getLogger(__name__)

class LocalEmbeddingService:
    """Local embedding service using sentence-transformers"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize local embedding service
        
        Args:
            model_name: HuggingFace model name (default: all-MiniLM-L6-v2)
                       This model produces 384-dimensional embeddings
        """
        self.model_name = model_name
        self.model = None
        self.embedding_dimension = 384  # Default for all-MiniLM-L6-v2
        
        # Try to load the model
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading local embedding model: {model_name}")
            self.model = SentenceTransformer(model_name)
            self.embedding_dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Local embedding model loaded successfully (dimension: {self.embedding_dimension})")
        except ImportError:
            logger.warning("sentence-transformers not installed. Install with: pip install sentence-transformers")
            self.model = None
        except Exception as e:
            logger.error(f"Failed to load local embedding model: {e}")
            self.model = None
    
    def is_available(self) -> bool:
        """Check if local embeddings are available"""
        return self.model is not None
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using local model
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats representing the embedding
            
        Raises:
            RuntimeError: If model is not available
        """
        if not self.is_available():
            raise RuntimeError("Local embedding model not available. Install sentence-transformers.")
        
        try:
            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            
            # Convert to list
            embedding_list = embedding.tolist()
            
            # Pad or truncate to 1536 dimensions to match OpenAI format
            # This allows compatibility with existing database schema
            if len(embedding_list) < 1536:
                # Pad with zeros
                embedding_list.extend([0.0] * (1536 - len(embedding_list)))
            elif len(embedding_list) > 1536:
                # Truncate
                embedding_list = embedding_list[:1536]
            
            return embedding_list
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embeddings
        """
        if not self.is_available():
            raise RuntimeError("Local embedding model not available")
        
        try:
            # Generate embeddings in batch
            embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
            
            # Convert to list and pad/truncate
            result = []
            for embedding in embeddings:
                embedding_list = embedding.tolist()
                
                # Pad or truncate to 1536 dimensions
                if len(embedding_list) < 1536:
                    embedding_list.extend([0.0] * (1536 - len(embedding_list)))
                elif len(embedding_list) > 1536:
                    embedding_list = embedding_list[:1536]
                
                result.append(embedding_list)
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            raise


# Global instance
_local_embedding_service = None

def get_local_embedding_service() -> LocalEmbeddingService:
    """Get or create local embedding service instance"""
    global _local_embedding_service
    
    if _local_embedding_service is None:
        _local_embedding_service = LocalEmbeddingService()
    
    return _local_embedding_service


def should_use_local_embeddings() -> bool:
    """Check if local embeddings should be used based on environment"""
    return os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"


if __name__ == "__main__":
    # Test the service
    service = LocalEmbeddingService()
    
    if service.is_available():
        print("✅ Local embedding service is available")
        print(f"   Model: {service.model_name}")
        print(f"   Dimension: {service.embedding_dimension}")
        
        # Test embedding generation
        test_text = "This is a test sentence for embedding generation."
        embedding = service.generate_embedding(test_text)
        print(f"   Generated embedding length: {len(embedding)}")
        print(f"   First 5 values: {embedding[:5]}")
    else:
        print("❌ Local embedding service not available")
        print("   Install with: pip install sentence-transformers")
