# Behave environment hooks
# Enterprise Test Strategy - Task 1.3

def before_all(context):
    """Run once before all scenarios."""
    context.config.setup_logging()
    context.api_base = "http://localhost:8000"


def before_scenario(context, scenario):
    """Run before each scenario."""
    context.response = None


def after_scenario(context, scenario):
    """Run after each scenario."""
    pass
