from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.domain.exceptions import Forbidden


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    role_id: int
    status: str


class UserPolicy:
    @staticmethod
    def can_view_feedback(current_user: CurrentUser) -> None:
        if current_user.role_id != settings.superadmin_role_id:
            raise Forbidden("Only superadmin can view feedback")
        
    @staticmethod
    def can_manage_economist_users(current_user: CurrentUser) -> None:
        if current_user.role_id not in {
            settings.superadmin_role_id,
            settings.admin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
        }:
            raise Forbidden("Only admin, superadmin, lead economist and project manager can manage economist users")
        
    @staticmethod
    def can_register_user(current_user: CurrentUser) -> None:
        UserPolicy.can_manage_economist_users(current_user)

    @staticmethod
    def can_login(status: str) -> None:
        if status != "active":
            raise Forbidden("User is not active")
        
    @staticmethod
    def can_list_users(current_user: CurrentUser) -> None:
        UserPolicy.can_manage_economist_users(current_user)
        
    @staticmethod
    def can_update_user_status(current_user: CurrentUser) -> None:
        UserPolicy.can_manage_economist_users(current_user)
        
    @staticmethod
    def can_update_user_role(current_user: CurrentUser) -> None:
        if current_user.role_id not in {
            settings.superadmin_role_id,
            settings.admin_role_id,
        }:
            raise Forbidden("Only admin and superadmin can update user roles")

    @staticmethod
    def can_manage_own_profile(current_user: CurrentUser) -> None:
        allowed_roles = {
            settings.superadmin_role_id,
            settings.admin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
            settings.economist_role_id,
            settings.contractor_role_id,
        }
        if current_user.role_id not in allowed_roles:
            raise Forbidden("Insufficient permissions to access own profile")

    @staticmethod
    def can_manage_own_company_contacts(current_user: CurrentUser) -> None:
        if current_user.role_id != settings.contractor_role_id:
            raise Forbidden("Only contractor can manage company contacts")

    @staticmethod
    def can_manage_requests(current_user: CurrentUser) -> None:
        allowed_roles = {
            settings.superadmin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
            settings.economist_role_id,
        }
        if current_user.role_id not in allowed_roles:
            raise Forbidden("Insufficient permissions for request management")
        
    @staticmethod
    def can_view_open_requests(current_user: CurrentUser) -> None:
        allowed_roles = {
            settings.superadmin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
            settings.economist_role_id,
            settings.contractor_role_id,
        }
        if current_user.role_id not in allowed_roles:
            raise Forbidden("Insufficient permissions for open requests")
        
    @staticmethod
    def can_create_offer(current_user: CurrentUser) -> None:
        if current_user.role_id != settings.contractor_role_id:
            raise Forbidden("Only contractor can create offers")

    @staticmethod
    def can_view_offered_requests(current_user: CurrentUser) -> None:
        if current_user.role_id != settings.contractor_role_id:
            raise Forbidden("Only contractor can view offered requests")
        
    @staticmethod
    def can_view_responsibility_dashboard(current_user: CurrentUser) -> None:
        allowed_roles = {
            settings.superadmin_role_id,
            settings.project_manager_role_id,
        }
        if current_user.role_id not in allowed_roles:
            raise Forbidden("Only superadmin and project manager can view responsibility dashboard")


class RequestPolicy:
    @staticmethod
    def can_edit(current_user: CurrentUser, *, request_owner_user_id: str) -> None:
        UserPolicy.can_manage_requests(current_user)
        if current_user.role_id == settings.economist_role_id and current_user.user_id != request_owner_user_id:
            raise Forbidden("Economist can edit only own requests")

    @staticmethod
    def can_change_owner(current_user: CurrentUser, *, request_owner_user_id: str) -> None:
        RequestPolicy.can_edit(current_user, request_owner_user_id=request_owner_user_id)
        if current_user.role_id not in {
            settings.superadmin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
        }:
            raise Forbidden("Only lead economist, project manager and superadmin can change request owner")
        
class OfferPolicy:
    @staticmethod
    def _economist_role_ids() -> set[int]:
        return {
            settings.superadmin_role_id,
            settings.economist_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
        }
    
    @staticmethod
    def can_view_contractor_info(current_user: CurrentUser, *, contractor_user_id: str) -> None:
        if current_user.role_id == settings.contractor_role_id:
            if current_user.user_id != contractor_user_id:
                raise Forbidden("Contractor can view only own profile")
            return
        UserPolicy.can_manage_requests(current_user)

    @staticmethod
    def can_access_contractor_offer(current_user: CurrentUser, *, offer_owner_user_id: str) -> None:
        UserPolicy.can_create_offer(current_user)
        if current_user.user_id != offer_owner_user_id:
            raise Forbidden("Contractor can access only own offers")

    @staticmethod
    def can_access_offer_workspace(
        current_user: CurrentUser,
        *,
        offer_owner_user_id: str,
    ) -> None:
        if current_user.role_id in OfferPolicy._economist_role_ids():
            return
        OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer_owner_user_id)

    def can_view_chat(
        current_user: CurrentUser,
        *,
        offer_owner_user_id: str,
    ) -> None:
        if current_user.role_id in OfferPolicy._economist_role_ids():
            return
        if current_user.role_id == settings.contractor_role_id and current_user.user_id == offer_owner_user_id:
            return
        raise Forbidden("Insufficient permissions to view chat")

    @staticmethod
    def can_send_chat_message(
        current_user: CurrentUser,
        *,
        offer_owner_user_id: str,
        request_owner_user_id: str,
    ) -> None:
        if current_user.role_id == settings.contractor_role_id and current_user.user_id == offer_owner_user_id:
            return
        
        if current_user.role_id in {
            settings.superadmin_role_id,
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
        }:
            return

        if current_user.role_id == settings.economist_role_id and current_user.user_id == request_owner_user_id:
            return

        raise Forbidden("Insufficient permissions to send chat message")