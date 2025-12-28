from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from uuid import UUID
import os
import jwt

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")  # Switch to anon_key for Auth + RLS
)

app = FastAPI(
    title="PPM SaaS MVP API",
    description="Moderne AI-gestützte Project Portfolio Management Lösung",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Pydantic Models ----------
class ProjectCreate(BaseModel):
    portfolio_id: UUID
    name: str
    description: str | None = None
    status: str = "planning"
    priority: str | None = None
    budget: float | None = None

class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    budget: float | None = None

class ProjectResponse(BaseModel):
    id: str
    portfolio_id: str
    name: str
    description: str | None
    status: str
    priority: str | None
    budget: float | None
    created_at: str

class ResourceCreate(BaseModel):
    name: str
    capacity: int
    skills: list[str]

class ResourceUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None
    skills: list[str] | None = None

class ResourceResponse(BaseModel):
    id: str
    name: str
    capacity: int
    skills: list[str]
    created_at: str

# ---------- Hilfsfunktion für UUID-Conversion ----------
def convert_uuids(data: list[dict] | dict):
    if isinstance(data, list):
        for item in data:
            for key, value in item.items():
                if isinstance(value, UUID):
                    item[key] = str(value)
        return data
    elif isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, UUID):
                data[key] = str(value)
        return data
    return data

# JWT Secret for verification
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Auth Dependency
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        # Fetch user organization from profiles
        response = supabase.table("profiles").select("organization_id").eq("id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=401, detail="User not found")
        organization_id = response.data[0]["organization_id"]
        return {"user_id": user_id, "organization_id": organization_id}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- Endpoints ----------
@app.get("/")
async def root():
    return {"message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀"}

@app.post("/projects/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, current_user = Depends(get_current_user)):
    try:
        response = supabase.table("projects").insert(project.dict()).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Projekts")
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/projects/")
async def list_projects(portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
    query = supabase.table("projects").select("*")
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    response = query.execute()
    return convert_uuids(response.data)

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return convert_uuids(response.data[0])

@app.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: UUID, project_update: ProjectUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in project_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    response = supabase.table("projects").update(data_to_update).eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return convert_uuids(response.data[0])

@app.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("projects").delete().eq("id", str(project_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return None

@app.post("/resources/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(resource: ResourceCreate, current_user = Depends(get_current_user)):
    try:
        response = supabase.table("resources").insert(resource.dict()).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen der Resource")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/resources/")
async def list_resources(current_user = Depends(get_current_user)):
    response = supabase.table("resources").select("*").execute()
    return response.data

@app.get("/resources/{resource_id}", response_model=ResourceResponse)
async def get_resource(resource_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("resources").select("*").eq("id", str(resource_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    return response.data[0]

@app.patch("/resources/{resource_id}", response_model=ResourceResponse)
async def update_resource(resource_id: UUID, resource_update: ResourceUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in resource_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")

    response = supabase.table("resources").update(data_to_update).eq("id", str(resource_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    return response.data[0]

@app.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(resource_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("resources").delete().eq("id", str(resource_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return None
