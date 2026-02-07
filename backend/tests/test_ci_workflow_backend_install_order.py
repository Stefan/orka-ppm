"""
CI workflow structure test: Backend Test job must install requirements.txt
before requirements-test.txt so runtime deps (e.g. PyJWT) are available.
"""

import os
import re


def _workflow_path():
    # From backend/tests/ go up to repo root
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(root, ".github", "workflows", "ci-cd.yml")


def test_backend_test_job_installs_requirements_txt_before_test():
    path = _workflow_path()
    assert os.path.isfile(path), f"Workflow not found: {path}"

    with open(path, "r") as f:
        content = f.read()

    # Find the Backend Test job block (between "backend-test:" and next top-level "  [a-z]")
    # Then ensure in that block requirements.txt line comes before requirements-test.txt
    main_match = re.search(
        r"backend-test:.*?(?=\n  [a-z-]+:|\n  # |\Z)",
        content,
        re.DOTALL,
    )
    assert main_match, "backend-test job not found in ci-cd.yml"
    block = main_match.group(0)

    idx_main = block.find("pip install -r backend/requirements.txt")
    idx_test = block.find("pip install -r backend/requirements-test.txt")

    assert idx_main != -1, "backend/requirements.txt install not found in Backend Test job"
    assert idx_test != -1, "backend/requirements-test.txt install not found in Backend Test job"
    assert idx_main < idx_test, (
        "Backend Test job must install backend/requirements.txt before backend/requirements-test.txt"
    )
