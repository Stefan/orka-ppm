# Language Preference API Fix - Requirements

## Problem Statement

The language preference API endpoints are failing with HTTP 422 (Unprocessable Content) and HTTP 503 (Service Unavailable) errors. Investigation reveals:

1. **422 Error on POST `/ai/help/language/preference`**: The frontend sends `{ language: "de" }` in the request body, but the backend expects `language` as a query parameter
2. **503 Error on GET `/ai/help/languages`**: The translation service is not being initialized properly, causing service unavailable errors
3. **Request Body Mismatch**: The backend endpoint signature expects `language: str` as a function parameter (which FastAPI interprets as a query parameter), but the frontend sends it in the JSON body

## Root Causes

### Issue 1: Parameter Type Mismatch
- **Backend** (`backend/routers/help_chat.py` line 717-718):
  ```python
  @router.post("/language/preference", response_model=FeedbackResponse)
  async def set_user_language_preference(
      language: str,  # FastAPI interprets this as query parameter
      current_user = Depends(get_current_user)
  ):
  ```
- **Frontend** (`lib/help-chat/api.ts` line 1055-1059):
  ```typescript
  async setUserLanguagePreference(language: string): Promise<FeedbackResponse> {
    const response = await apiRequest(HELP_CHAT_CONFIG.endpoints.languagePreference, {
      method: 'POST',
      body: JSON.stringify({ language })  // Sends in body
    })
  }
  ```

### Issue 2: Translation Service Initialization
- The `get_translation_service()` function in `backend/routers/help_chat.py` initializes the service lazily
- If `OPENAI_API_KEY` is not configured, it raises HTTP 503
- The service requires both Supabase client and OpenAI API key to function

### Issue 3: Duplicate Endpoint Definitions
- Language endpoints are defined in both `backend/simple_server.py` and `backend/routers/help_chat.py`
- The router version (`help_chat.py`) is the one being used (mounted at `/ai/help`)
- The `simple_server.py` version is likely a fallback/mock implementation

## Requirements

### Requirement 1: Fix POST Language Preference Endpoint

**User Story:** As a user, when I select a language, the system should save my preference without errors.

#### Acceptance Criteria

1.1. THE backend endpoint SHALL accept language preference in the request body as JSON
1.2. THE backend endpoint SHALL validate that the language is one of the supported languages
1.3. THE backend endpoint SHALL return HTTP 200 with success message when preference is saved
1.4. THE backend endpoint SHALL return HTTP 400 with error message when language is invalid
1.5. THE backend endpoint SHALL require authentication (current_user dependency)

### Requirement 2: Fix GET Supported Languages Endpoint

**User Story:** As a user, I want to see available languages without encountering service errors.

#### Acceptance Criteria

2.1. THE endpoint SHALL return the list of supported languages even if translation service is unavailable
2.2. THE endpoint SHALL provide a fallback list of languages when OpenAI service is not configured
2.3. THE endpoint SHALL return HTTP 200 with language list in all cases
2.4. THE endpoint SHALL include language metadata (code, name, native_name, formal_tone)
2.5. THE endpoint SHALL not require OpenAI API key for basic language list retrieval

### Requirement 3: Graceful Service Degradation

**User Story:** As a user, I want language selection to work even when translation services are unavailable.

#### Acceptance Criteria

3.1. THE system SHALL store language preferences in the database without requiring translation service
3.2. THE system SHALL retrieve language preferences from the database without requiring translation service
3.3. THE system SHALL provide a static list of supported languages as fallback
3.4. THE system SHALL log warnings when translation service is unavailable but continue operation
3.5. THE system SHALL only require translation service for actual translation operations, not preference management

### Requirement 4: API Contract Consistency

**User Story:** As a developer, I want consistent API contracts between frontend and backend.

#### Acceptance Criteria

4.1. THE POST language preference endpoint SHALL accept a JSON body with `{ "language": "string" }`
4.2. THE GET language preference endpoint SHALL return `{ "language": "string" }`
4.3. THE GET supported languages endpoint SHALL return `{ "languages": [{ "code": "string", "name": "string", "native_name": "string", "formal_tone": boolean }] }`
4.4. THE API SHALL use consistent error response format across all endpoints
4.5. THE API documentation SHALL accurately reflect the request/response formats

### Requirement 5: Error Handling

**User Story:** As a user, I want clear error messages when language operations fail.

#### Acceptance Criteria

5.1. THE system SHALL return HTTP 422 with validation details when request format is invalid
5.2. THE system SHALL return HTTP 400 with error message when language code is unsupported
5.3. THE system SHALL return HTTP 500 with error message when database operations fail
5.4. THE system SHALL NOT return HTTP 503 for language preference operations
5.5. THE system SHALL log detailed error information for debugging while showing user-friendly messages

### Requirement 6: Frontend Error Handling

**User Story:** As a user, I want the application to continue working even if language sync fails.

#### Acceptance Criteria

6.1. THE frontend SHALL not block user interaction when language preference sync fails
6.2. THE frontend SHALL store language preference locally even if server sync fails
6.3. THE frontend SHALL retry failed language preference sync on next language change
6.4. THE frontend SHALL display a non-intrusive warning when server sync fails
6.5. THE frontend SHALL continue to function with local language preference when server is unavailable

## Technical Approach

### Backend Changes Required

1. **Update `set_user_language_preference` endpoint** to accept language in request body:
   ```python
   @router.post("/language/preference", response_model=FeedbackResponse)
   async def set_user_language_preference(
       request: LanguagePreferenceRequest,  # Use Pydantic model
       current_user = Depends(get_current_user)
   ):
   ```

2. **Add Pydantic model** for request validation:
   ```python
   class LanguagePreferenceRequest(BaseModel):
       language: str = Field(..., description="Language code (en, de, fr, es, pl, gsw)")
   ```

3. **Separate language preference storage from translation service**:
   - Language preferences should be stored/retrieved directly from database
   - Translation service should only be used for actual translation operations
   - Provide static fallback for supported languages list

4. **Update `get_supported_languages` endpoint** to not require translation service:
   ```python
   @router.get("/languages")
   async def get_supported_languages():
       # Return static list, don't depend on translation service
       return SUPPORTED_LANGUAGES_LIST
   ```

### Frontend Changes Required

1. **No changes needed** - frontend is already sending correct format
2. **Improve error handling** in `useLanguage.ts`:
   - Catch and log errors without blocking UI
   - Continue with local preference on server failure

### Testing Requirements

1. **Unit tests** for backend endpoints with various request formats
2. **Integration tests** for language preference flow
3. **Error scenario tests** for service unavailability
4. **Property-based tests** for API contract validation

## Success Criteria

1. Users can select languages without encountering 422 or 503 errors
2. Language preferences persist across sessions
3. Application continues to function when translation service is unavailable
4. All existing i18n functionality continues to work
5. No console errors related to language preference API calls
