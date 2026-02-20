class DomainError(Exception):
    pass


class NotFound(DomainError):
    pass


class Unauthorized(DomainError):
    pass


class Forbidden(DomainError):
    pass


class Conflict(DomainError):
    pass