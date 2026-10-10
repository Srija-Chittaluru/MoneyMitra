import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.goals import service
from app.modules.goals.schemas import ContributionIn, ContributionOut, GoalIn, GoalOut
from app.modules.goals.types import GoalStatus
from app.modules.users.models import User

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalOut]:
    return service.goals_out(db, current_user, include_archived=include_archived)


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    return service.goal_out(db, current_user, service.create_goal(db, current_user, payload))


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    return service.goal_out(db, current_user, service.get_goal(db, current_user, goal_id))


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: uuid.UUID,
    payload: GoalIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = service.update_goal(db, service.get_goal(db, current_user, goal_id), payload)
    return service.goal_out(db, current_user, goal)


def _status_route(new_status: GoalStatus):
    def change_status(
        goal_id: uuid.UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> GoalOut:
        goal = service.set_status(db, service.get_goal(db, current_user, goal_id), new_status)
        return service.goal_out(db, current_user, goal)

    return change_status


router.post("/{goal_id}/archive", response_model=GoalOut, name="archive_goal")(_status_route(GoalStatus.ARCHIVED))
router.post("/{goal_id}/complete", response_model=GoalOut, name="complete_goal")(_status_route(GoalStatus.COMPLETED))
router.post("/{goal_id}/reopen", response_model=GoalOut, name="reopen_goal")(_status_route(GoalStatus.ACTIVE))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_goal(db, service.get_goal(db, current_user, goal_id))


@router.get("/{goal_id}/contributions", response_model=list[ContributionOut])
def list_contributions(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContributionOut]:
    goal = service.get_goal(db, current_user, goal_id)
    return [ContributionOut.model_validate(item) for item in service.list_contributions(db, goal)]


@router.post("/{goal_id}/contributions", response_model=ContributionOut, status_code=status.HTTP_201_CREATED)
def add_contribution(
    goal_id: uuid.UUID,
    payload: ContributionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContributionOut:
    goal = service.get_goal(db, current_user, goal_id)
    return ContributionOut.model_validate(service.add_contribution(db, goal, payload))


@router.put("/{goal_id}/contributions/{contribution_id}", response_model=ContributionOut)
def update_contribution(
    goal_id: uuid.UUID,
    contribution_id: uuid.UUID,
    payload: ContributionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ContributionOut:
    goal = service.get_goal(db, current_user, goal_id)
    item = service.get_contribution(db, goal, contribution_id)
    return ContributionOut.model_validate(service.update_contribution(db, goal, item, payload))


@router.delete("/{goal_id}/contributions/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contribution(
    goal_id: uuid.UUID,
    contribution_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = service.get_goal(db, current_user, goal_id)
    service.delete_contribution(db, goal, service.get_contribution(db, goal, contribution_id))
