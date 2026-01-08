"""
Application configuration and environment variables
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    """Application settings from environment variables"""
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Redis Configuration (optional)
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    
    # Application Configuration
    APP_NAME: str = "PPM SaaS MVP API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI-powered Project Portfolio Management Platform"
    
    # Environment Detection
    @property
    def environment(self) -> str:
        """Detect the current environment"""
        if os.getenv("VERCEL"):
            return "vercel"
        elif os.getenv("RENDER"):
            return "render"
        elif os.getenv("HEROKU"):
            return "heroku"
        elif os.getenv("RAILWAY"):
            return "railway"
        elif os.getenv("FLY_APP_NAME"):
            return "fly"
        elif os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production":
            return "production"
        else:
            return "development"
    
    @property
    def base_url(self) -> str:
        """Determine base URL for testing based on environment"""
        env = self.environment
        if env == "vercel":
            base_url = os.getenv("VERCEL_URL", "http://localhost:8000")
            if not base_url.startswith("http"):
                base_url = f"https://{base_url}"
            return base_url
        elif env == "render":
            return os.getenv("RENDER_EXTERNAL_URL", os.getenv("BASE_URL", "http://localhost:8000"))
        elif env == "heroku":
            return os.getenv("HEROKU_APP_URL", os.getenv("BASE_URL", "http://localhost:8000"))
        else:
            return os.getenv("BASE_URL", "http://localhost:8000")
    
    def validate_required_settings(self) -> bool:
        """Validate that required settings are present"""
        required_settings = [
            ("SUPABASE_URL", self.SUPABASE_URL),
            ("SUPABASE_ANON_KEY", self.SUPABASE_ANON_KEY),
        ]
        
        missing_settings = []
        for name, value in required_settings:
            if not value:
                missing_settings.append(name)
        
        if missing_settings:
            print(f"⚠️ WARNING: Missing required environment variables: {', '.join(missing_settings)}")
            return False
        
        return True
    
    def print_debug_info(self):
        """Print debug information about current settings"""
        print(f"🔍 Backend Environment Check:")
        print(f"- Environment: {self.environment}")
        print(f"- Base URL: {self.base_url}")
        print(f"- SUPABASE_URL set: {bool(self.SUPABASE_URL)}")
        print(f"- SUPABASE_ANON_KEY set: {bool(self.SUPABASE_ANON_KEY)}")
        print(f"- OPENAI_API_KEY set: {bool(self.OPENAI_API_KEY)}")
        print(f"- REDIS_URL set: {bool(self.REDIS_URL)}")

# Global settings instance
settings = Settings()