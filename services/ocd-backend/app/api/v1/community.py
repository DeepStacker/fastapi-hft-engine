"""
Community API Router - RESTful endpoints for community module.

Provides endpoints for:
- Rooms: List, get, create, update
- Posts: CRUD with threading
- Reactions: Add, update, remove
- Reputation: User stats, leaderboard
- Feature Requests: CRUD with voting
- Moderation: Pin, mute, moderate (admin)
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_current_admin_user
from app.config.database import get_db as get_db_session
from app.services.community import CommunityService, get_community_service
from app.schemas.community import (
    CommunityRoomCreate,
    CommunityRoomUpdate,
    CommunityRoomResponse,
    CommunityRoomListResponse,
    CommunityPostCreate,
    CommunityPostUpdate,
    CommunityPostResponse,
    CommunityPostListResponse,
    ThreadResponse,
    ReactionCreate,
    ReactionSummary,
    UserReputationResponse,
    LeaderboardResponse,
    FeatureRequestCreate,
    FeatureRequestUpdate,
    FeatureRequestResponse,
    FeatureRequestListResponse,
    MuteUserRequest,
    PinPostRequest,
)
from core.database.models import AppUserDB

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["community"])


# ═══════════════════════════════════════════════════════════════════════════════
# ROOM ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/rooms", response_model=CommunityRoomListResponse)
async def list_rooms(
    db: AsyncSession = Depends(get_db_session),
):
    """Get all community rooms."""
    service = get_community_service(db)
    rooms = await service.get_all_rooms()
    return CommunityRoomListResponse(rooms=rooms, total=len(rooms))


@router.get("/rooms/{slug}", response_model=CommunityRoomResponse)
async def get_room(
    slug: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a specific room by slug."""
    service = get_community_service(db)
    room = await service.get_room_by_slug(slug)
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return room


@router.post("/rooms", response_model=CommunityRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_data: CommunityRoomCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Create a new room (admin only)."""
    service = get_community_service(db)
    room = await service.create_room(room_data, current_user.id)
    await db.commit()
    return room


@router.patch("/rooms/{room_id}", response_model=CommunityRoomResponse)
async def update_room(
    room_id: int,
    room_data: CommunityRoomUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Update a room (admin only)."""
    service = get_community_service(db)
    room = await service.update_room(room_id, room_data, current_user.id)
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    await db.commit()
    return room


# ═══════════════════════════════════════════════════════════════════════════════
# POST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/rooms/{slug}/posts", response_model=CommunityPostListResponse)
async def list_posts_in_room(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[AppUserDB] = Depends(get_current_user),
):
    """Get paginated posts in a room."""
    service = get_community_service(db)
    
    user_id = current_user.id if current_user else None
    posts, total = await service.get_posts_in_room(slug, page, page_size, user_id)
    
    return CommunityPostListResponse(
        posts=posts,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/posts/{post_id}", response_model=ThreadResponse)
async def get_post_with_replies(
    post_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[AppUserDB] = Depends(get_current_user),
):
    """Get a post with its replies (thread view)."""
    service = get_community_service(db)
    
    user_id = current_user.id if current_user else None
    result = await service.get_post_with_replies(post_id, user_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return ThreadResponse(**result)


@router.post("/rooms/{slug}/posts", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    slug: str,
    post_data: CommunityPostCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Create a new post in a room."""
    service = get_community_service(db)
    
    post, error = await service.create_post(slug, post_data, current_user)
    
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return post


@router.patch("/posts/{post_id}", response_model=CommunityPostResponse)
async def update_post(
    post_id: int,
    post_data: CommunityPostUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Update a post (author or admin only)."""
    service = get_community_service(db)
    
    post, error = await service.update_post(post_id, post_data, current_user)
    
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return post


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Delete a post (author or admin only)."""
    service = get_community_service(db)
    
    success, error = await service.delete_post(post_id, current_user)
    
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# REACTION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/posts/{post_id}/react", status_code=status.HTTP_201_CREATED)
async def add_reaction(
    post_id: int,
    reaction: ReactionCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Add or update a reaction to a post."""
    service = get_community_service(db)
    
    success, error = await service.add_reaction(post_id, reaction, current_user)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return {"success": True, "message": "Reaction added"}


@router.delete("/posts/{post_id}/react", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    post_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Remove a reaction from a post."""
    service = get_community_service(db)
    
    success, error = await service.remove_reaction(post_id, current_user)
    
    if not success:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# REPUTATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════════════════
# BOOKMARK ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/bookmarks")
async def get_bookmarks(
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Get user's bookmarked posts."""
    service = get_community_service(db)
    posts = await service.get_user_bookmarks(current_user.id)
    return {"posts": posts}


@router.post("/posts/{post_id}/bookmark", status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    post_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Bookmark a post."""
    service = get_community_service(db)
    success = await service.add_bookmark(post_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to bookmark post")
    
    await db.commit()
    return {"success": True, "message": "Post bookmarked"}


@router.delete("/posts/{post_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    post_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Remove a bookmark."""
    service = get_community_service(db)
    success = await service.remove_bookmark(post_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    await db.commit()

@router.get("/users/{user_id}/reputation", response_model=UserReputationResponse)
async def get_user_reputation(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a user's reputation stats."""
    service = get_community_service(db)
    
    rep = await service.get_user_reputation(user_id)
    
    if not rep:
        raise HTTPException(status_code=404, detail="User not found")
    
    return rep


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[AppUserDB] = Depends(get_current_user),
):
    """Get reputation leaderboard."""
    service = get_community_service(db)
    
    user_id = current_user.id if current_user else None
    return await service.get_leaderboard(limit, user_id)


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE REQUEST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/features", response_model=FeatureRequestListResponse)
async def list_feature_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[AppUserDB] = Depends(get_current_user),
):
    """Get paginated feature requests."""
    service = get_community_service(db)
    
    user_id = current_user.id if current_user else None
    requests, total = await service.get_feature_requests(page, page_size, status, user_id)
    
    return FeatureRequestListResponse(
        requests=requests,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/features", response_model=FeatureRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_feature_request(
    data: FeatureRequestCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Create a new feature request."""
    service = get_community_service(db)
    
    request = await service.create_feature_request(data, current_user)
    await db.commit()
    return request


@router.post("/features/{feature_id}/vote", status_code=status.HTTP_201_CREATED)
async def vote_for_feature(
    feature_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Vote for a feature request."""
    service = get_community_service(db)
    
    success, message = await service.vote_for_feature(feature_id, current_user)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    await db.commit()
    return {"success": True, "message": message}


@router.delete("/features/{feature_id}/vote", status_code=status.HTTP_204_NO_CONTENT)
async def unvote_for_feature(
    feature_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_user),
):
    """Remove vote from a feature request."""
    service = get_community_service(db)
    
    success = await service.unvote_for_feature(feature_id, current_user)
    
    if not success:
        raise HTTPException(status_code=404, detail="Vote not found")
    
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# MODERATION ENDPOINTS (Admin Only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/posts/{post_id}/pin")
async def pin_post(
    post_id: int,
    data: PinPostRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Pin or unpin a post (admin only)."""
    service = get_community_service(db)
    
    success, error = await service.pin_post(post_id, data.is_pinned, current_user)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return {"success": True, "is_pinned": data.is_pinned}


@router.post("/users/{user_id}/mute")
async def mute_user(
    user_id: UUID,
    data: MuteUserRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Mute a user (admin only)."""
    service = get_community_service(db)
    
    success, error = await service.mute_user(
        user_id, data.duration_hours, data.reason, current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return {"success": True, "message": f"User muted for {data.duration_hours} hours"}


@router.post("/users/{user_id}/unmute")
async def unmute_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Unmute a user (admin only)."""
    service = get_community_service(db)
    
    success, error = await service.unmute_user(user_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return {"success": True, "message": "User unmuted"}


@router.post("/users/{user_id}/verify")
async def verify_trader(
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Verify a user as trader (admin only)."""
    service = get_community_service(db)
    
    success, error = await service.verify_trader(user_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=400, detail=error)
    
    await db.commit()
    return {"success": True, "message": "User verified as trader"}


@router.patch("/features/{feature_id}", response_model=FeatureRequestResponse)
async def update_feature_request(
    feature_id: int,
    data: FeatureRequestUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: AppUserDB = Depends(get_current_admin_user),
):
    """Update a feature request status (admin only)."""
    service = get_community_service(db)
    
    request = await service.repo.update_feature_request(
        feature_id,
        data.model_dump(exclude_unset=True)
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Feature request not found")
    
    await db.commit()
    
    # Build response
    from app.schemas.community import AuthorInfo, CommunityRole
    author_info = None
    if request.author:
        author_info = AuthorInfo(
            id=request.author.id,
            username=request.author.username,
            profile_image=request.author.profile_image,
            reputation_score=0,
            verified_trader=False,
            community_role=CommunityRole.USER,
        )
    
    return FeatureRequestResponse(
        id=request.id,
        author_id=request.author_id,
        title=request.title,
        description=request.description,
        category=request.category,
        status=request.status,
        admin_response=request.admin_response,
        vote_count=request.vote_count,
        created_at=request.created_at,
        updated_at=request.updated_at,
        author=author_info,
        user_voted=False,
    )
