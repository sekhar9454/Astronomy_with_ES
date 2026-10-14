class ServiceError(Exception):
    def __init__(self, message, error_code="INVALID_INPUT", status_code=400, details=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
