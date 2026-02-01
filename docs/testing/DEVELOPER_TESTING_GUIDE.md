# Developer Testing Guidelines

**Enterprise Test Strategy - Task 26.2**

## Writing unit tests

### Backend (pytest)

- Place tests in `backend/tests/` or `backend/tests/unit/`.
- Name files `test_*.py` or `*_test.py`.
- Use fixtures from `backend/tests/conftest.py` (e.g. `mock_supabase`, `project_factory`).
- Mark with `@pytest.mark.unit` for filtering.
- Use `@pytest.mark.parametrize` for multiple inputs.

```python
@pytest.mark.unit
def test_example(mock_supabase):
    mock_supabase.table.return_value.execute.return_value = Mock(data=[{"id": "1"}])
    # assert ...
```

### Frontend (Jest + React Testing Library)

- Place tests in `__tests__/` or next to components in `**/*.test.tsx`.
- Use `render` from `@testing-library/react` (or custom render in `__tests__/setup/react-testing-library.tsx`).
- Prefer `screen.getByRole`, `getByLabelText` over `getByTestId` for accessibility.

```tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

test('renders title', () => {
  render(<MyComponent title="Hello" />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Property-based tests

- **Backend:** Use `hypothesis`. Example: `@given(st.integers(0, 100))` then assert invariants.
- **Frontend:** Use `fast-check` with Jest. Example: `fc.assert(fc.property(fc.string(), s => ...))`.
- Run with at least 100 examples; increase in CI (e.g. 200).

## Integration tests

- **Backend:** Use `mock_supabase` or a test DB; avoid production data.
- **Frontend:** Use MSW handlers in `__tests__/integration/msw-handlers.ts` to mock API.

## Running tests locally

- Backend: `cd backend && pytest tests/ -v`
- Frontend: `npm run test` or `npm run test:watch`
- E2E: `npm run test:e2e`
- Coverage: `npm run test:coverage` (frontend), `pytest --cov=. --cov-report=html` (backend)

## Handling failures

- Fix flaky tests (replace fixed sleeps with explicit waits).
- Do not disable tests without a ticket; use `@pytest.mark.skip` or `it.skip` with a reason and link.
