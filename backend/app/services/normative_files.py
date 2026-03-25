from __future__ import annotations

from dataclasses import dataclass

from app.domain.policies import CurrentUser, UserPolicy
from app.repositories.files import FileRepository
from app.services.files import FileService, PreparedUpload


@dataclass(frozen=True)
class NormativeFileUpsertResult:
    normative_id: int
    file_id: int


class NormativeFileService:
    def __init__(self, files: FileRepository, *, file_service: FileService | None = None) -> None:
        self._files = files
        self._file_service = file_service or FileService(files)

    async def upload_normative_file(
        self,
        *,
        current_user: CurrentUser,
        upload: PreparedUpload,
        normative_id: int = 1,
    ) -> NormativeFileUpsertResult:
        UserPolicy.ensure_can_manage_normative_files(current_user)

        new_file = await self._file_service.create_normative_file(upload=upload)
        old_file_id = await self._files.get_normative_file_id(normative_id=normative_id)
        await self._files.upsert_normative_file(normative_id=normative_id, file_id=new_file.id)

        if old_file_id is not None and old_file_id != new_file.id:
            remaining_links = await self._files.count_links(file_id=old_file_id)
            if remaining_links == 0:
                await self._file_service.delete_file(file_id=old_file_id)

        return NormativeFileUpsertResult(normative_id=normative_id, file_id=new_file.id)
