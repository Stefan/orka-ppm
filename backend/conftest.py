"""Root conftest for backend tests. Loaded first when pytest runs from backend/."""
import warnings

# Suppress Pydantic/deprecation warnings during collection (avoids collection errors)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning, message=".*deprecated.*")
