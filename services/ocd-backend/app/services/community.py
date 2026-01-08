"""
Community Service - Business logic for community module.

Handles:
- Post creation with permission checks
- Rate limiting and cooldowns
- Spam/content filtering
- Reputation management
- Moderation actions
"""
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
import re
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.community import CommunityRepository, get_community_repository
from app.schemas.community import (
    CommunityRoomCreate,
    CommunityRoomUpdate,
    CommunityRoomResponse,
    CommunityPostCreate,
    CommunityPostUpdate,
    CommunityPostResponse,
    ReactionCreate,
    UserReputationResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    FeatureRequestCreate,
    FeatureRequestUpdate,
    FeatureRequestResponse,
    AuthorInfo,
    CommunityRole,
    RoomType,
    ReactionType,
    TradeType,
)
from core.database.community_models import (
    CommunityRoomDB,
    CommunityPostDB,
    UserReputationDB,
    CommunityRole as DBCommunityRole,
)
from core.database.models import AppUserDB, UserRole

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# SPAM FILTERING
# ═══════════════════════════════════════════════════════════════════════════════

# Banned words/phrases for spam detection
SPAM_PATTERNS = [
    r'\b(buy now|sell now|guaranteed profit|100% accurate)\b',
    r'\b(target|sl|stoploss)\s*:?\s*\d+',  # Live trade calls
    r'\bjoin\s*(my|our)?\s*(telegram|whatsapp|group)\b',
    r'\b(tip|signal)\s*provider\b',
    r'\bpaid\s*(group|channel|tips)\b',
]

# Compiled patterns for efficiency
SPAM_REGEX = [re.compile(p, re.IGNORECASE) for p in SPAM_PATTERNS]


def check_spam(content: str) -> Tuple[bool, Optional[str]]:
    """Check content for spam patterns."""
    for pattern in SPAM_REGEX:
        if pattern.search(content):
            return True, f"Content contains prohibited pattern: {pattern.pattern}"
    return False, None


def check_live_trade_call(content: str) -> bool:
    """Check if content contains a live trade call."""
    live_call_patterns = [
        r'\b(buy|sell|enter|exit)\s*(at|@)?\s*\d+',
        r'\btarget\s*:?\s*\d+',
        r'\bstoploss\s*:?\s*\d+',
        r'\bsl\s*:?\s*\d+',
    ]
    for pattern in live_call_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# COMMUNITY SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class CommunityService:
    """Service layer for community operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = get_community_repository(db)
    
    # ═══════════════════════════════════════════════════════════════════════
    # ROOM OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_all_rooms(self) -> List[CommunityRoomResponse]:
        """Get all active rooms with post counts."""
        rooms = await self.repo.get_all_rooms(active_only=True)
        result = []
        
        for room in rooms:
            post_count = await self.repo.get_room_post_count(room.id)
            room_dict = {
                "id": room.id,
                "slug": room.slug,
                "name": room.name,
                "description": room.description,
                "room_type": room.room_type,
                "is_read_only": room.is_read_only,
                "min_reputation_to_post": room.min_reputation_to_post,
                "post_cooldown_seconds": room.post_cooldown_seconds,
                "allowed_roles": room.allowed_roles,
                "is_active": room.is_active,
                "created_at": room.created_at,
                "post_count": post_count,
            }
            result.append(CommunityRoomResponse(**room_dict))
        
        return result
    
    async def get_room_by_slug(self, slug: str) -> Optional[CommunityRoomResponse]:
        """Get a room by slug."""
        room = await self.repo.get_room_by_slug(slug)
        if not room:
            return None
        
        post_count = await self.repo.get_room_post_count(room.id)
        return CommunityRoomResponse(
            id=room.id,
            slug=room.slug,
            name=room.name,
            description=room.description,
            room_type=room.room_type,
            is_read_only=room.is_read_only,
            min_reputation_to_post=room.min_reputation_to_post,
            post_cooldown_seconds=room.post_cooldown_seconds,
            allowed_roles=room.allowed_roles,
            is_active=room.is_active,
            created_at=room.created_at,
            post_count=post_count,
        )
    
    async def create_room(
        self,
        room_data: CommunityRoomCreate,
        admin_id: UUID
    ) -> CommunityRoomResponse:
        """Create a new room (admin only)."""
        room = await self.repo.create_room(room_data.model_dump())
        logger.info(f"Room created: {room.slug} by admin {admin_id}")
        
        return CommunityRoomResponse(
            id=room.id,
            slug=room.slug,
            name=room.name,
            description=room.description,
            room_type=room.room_type,
            is_read_only=room.is_read_only,
            min_reputation_to_post=room.min_reputation_to_post,
            post_cooldown_seconds=room.post_cooldown_seconds,
            allowed_roles=room.allowed_roles,
            is_active=room.is_active,
            created_at=room.created_at,
            post_count=0,
        )
    
    async def update_room(
        self,
        room_id: int,
        room_data: CommunityRoomUpdate,
        admin_id: UUID
    ) -> Optional[CommunityRoomResponse]:
        """Update a room (admin only)."""
        room = await self.repo.update_room(
            room_id,
            room_data.model_dump(exclude_unset=True)
        )
        if not room:
            return None
        
        logger.info(f"Room updated: {room.slug} by admin {admin_id}")
        return await self.get_room_by_slug(room.slug)
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_posts_in_room(
        self,
        room_slug: str,
        page: int = 1,
        page_size: int = 20,
        current_user_id: Optional[UUID] = None
    ) -> Tuple[List[CommunityPostResponse], int]:
        """Get paginated posts in a room."""
        room = await self.repo.get_room_by_slug(room_slug)
        if not room:
            return [], 0
        
        posts, total = await self.repo.get_posts_in_room(
            room.id, page, page_size
        )
        
        result = []
        for post in posts:
            post_response = await self._build_post_response(post, current_user_id)
            result.append(post_response)
        
        return result, total
    
    async def get_post_with_replies(
        self,
        post_id: int,
        current_user_id: Optional[UUID] = None
    ) -> Optional[dict]:
        """Get a post with its replies."""
        post = await self.repo.get_post_by_id(post_id)
        if not post or post.is_deleted:
            return None
        
        replies, total_replies = await self.repo.get_post_replies(post_id)
        
        post_response = await self._build_post_response(post, current_user_id)
        reply_responses = [
            await self._build_post_response(r, current_user_id)
            for r in replies
        ]
        
        return {
            "post": post_response,
            "replies": reply_responses,
            "total_replies": total_replies,
        }
    
    async def create_post(
        self,
        room_slug: str,
        post_data: CommunityPostCreate,
        author: AppUserDB
    ) -> Tuple[Optional[CommunityPostResponse], Optional[str]]:
        """Create a post with permission and content checks."""
        room = await self.repo.get_room_by_slug(room_slug)
        if not room:
            return None, "Room not found"
        
        # Check permissions
        can_post, error = await self._check_posting_permission(
            author, room
        )
        if not can_post:
            return None, error
        
        # Content validation
        is_spam, spam_reason = check_spam(post_data.content)
        if is_spam:
            return None, spam_reason
        
        # Check for live trade calls in non-allowed rooms
        if room.room_type != RoomType.SIGNAL_DISCUSSION:
            if check_live_trade_call(post_data.content):
                return None, "Live trade calls are not allowed in this room"
        
        # Trade breakdown validation
        if room.room_type == RoomType.TRADE_BREAKDOWN:
            if not post_data.instrument or not post_data.entry_price or not post_data.exit_price:
                return None, "Trade breakdowns require instrument, entry and exit prices"
            if not post_data.trade_type:
                return None, "Trade breakdowns require trade type (CE/PE/FUT)"
        
        # Create post
        post_dict = post_data.model_dump()
        post_dict['room_id'] = room.id
        post_dict['author_id'] = author.id
        post_dict['content_type'] = 'trade_breakdown' if room.room_type == RoomType.TRADE_BREAKDOWN else 'text'
        
        post = await self.repo.create_post(post_dict)
        
        # Update user's last post time in reputation
        await self.repo.update_reputation(author.id, {
            'last_post_at': datetime.utcnow()
        })
        
        logger.info(f"Post created: {post.id} in room {room_slug} by {author.username}")
        
        return await self._build_post_response(post, author.id), None
    
    async def update_post(
        self,
        post_id: int,
        post_data: CommunityPostUpdate,
        user: AppUserDB
    ) -> Tuple[Optional[CommunityPostResponse], Optional[str]]:
        """Update a post (author or admin only)."""
        post = await self.repo.get_post_by_id(post_id)
        if not post:
            return None, "Post not found"
        
        # Check ownership or admin
        if post.author_id != user.id and user.role != UserRole.ADMIN:
            return None, "You can only edit your own posts"
        
        # Content validation
        if post_data.content:
            is_spam, spam_reason = check_spam(post_data.content)
            if is_spam:
                return None, spam_reason
        
        updated = await self.repo.update_post(
            post_id,
            post_data.model_dump(exclude_unset=True)
        )
        
        if not updated:
            return None, "Failed to update post"
        
        return await self._build_post_response(updated, user.id), None
    
    async def delete_post(
        self,
        post_id: int,
        user: AppUserDB
    ) -> Tuple[bool, Optional[str]]:
        """Delete a post (author or admin only)."""
        post = await self.repo.get_post_by_id(post_id)
        if not post:
            return False, "Post not found"
        
        # Check ownership or admin
        if post.author_id != user.id and user.role != UserRole.ADMIN:
            return False, "You can only delete your own posts"
        
        success = await self.repo.delete_post(post_id, soft_delete=True)
        if success:
            logger.info(f"Post deleted: {post_id} by {user.username}")
        
        return success, None if success else "Failed to delete post"
    
    async def pin_post(
        self,
        post_id: int,
        is_pinned: bool,
        admin: AppUserDB
    ) -> Tuple[bool, Optional[str]]:
        """Pin or unpin a post (admin only)."""
        post = await self.repo.pin_post(post_id, is_pinned)
        if not post:
            return False, "Post not found"
        
        logger.info(f"Post {'pinned' if is_pinned else 'unpinned'}: {post_id} by {admin.username}")
        return True, None
    
    async def _check_posting_permission(
        self,
        user: AppUserDB,
        room: CommunityRoomDB
    ) -> Tuple[bool, Optional[str]]:
        """Check if user can post in room."""
        # Admins can always post
        if user.role == UserRole.ADMIN:
            return True, None
        
        # Check if room is read-only
        if room.is_read_only:
            return False, "This room is read-only"
        
        # Check role-based access
        user_role = user.role.value if user.role else "user"
        if room.allowed_roles and user_role not in room.allowed_roles:
            return False, f"Only {', '.join(room.allowed_roles)} can post in this room"
        
        # Check reputation and cooldowns
        can_post, error = await self.repo.check_user_can_post(user.id, room.id)
        if not can_post:
            return False, error
        
        return True, None
    
    async def _build_post_response(
        self,
        post: CommunityPostDB,
        current_user_id: Optional[UUID] = None
    ) -> CommunityPostResponse:
        """Build a post response with author info and user reaction."""
        # Get author info with reputation
        author_info = None
        if post.author:
            rep = await self.repo.get_user_reputation(post.author_id)
            author_info = AuthorInfo(
                id=post.author.id,
                username=post.author.username,
                profile_image=post.author.profile_image,
                reputation_score=rep.reputation_score if rep else 0,
                verified_trader=rep.verified_trader if rep else False,
                community_role=rep.community_role if rep else CommunityRole.USER,
            )
        
        # Get user's reaction
        user_reaction = None
        if current_user_id:
            reaction = await self.repo.get_user_reaction(post.id, current_user_id)
            if reaction:
                user_reaction = reaction.reaction_type
        
        return CommunityPostResponse(
            id=post.id,
            room_id=post.room_id,
            parent_post_id=post.parent_post_id,
            author_id=post.author_id,
            signal_id=post.signal_id,
            title=post.title,
            content=post.content,
            instrument=post.instrument,
            entry_price=post.entry_price,
            exit_price=post.exit_price,
            trade_type=post.trade_type,
            trade_reason=post.trade_reason,
            trade_explanation=post.trade_explanation,
            screenshot_url=post.screenshot_url,
            is_pinned=post.is_pinned,
            is_edited=post.is_edited,
            upvotes=post.upvotes,
            downvotes=post.downvotes,
            reply_count=post.reply_count,
            net_votes=post.upvotes - post.downvotes,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=author_info,
            user_reaction=user_reaction,
        )
    
    # ═══════════════════════════════════════════════════════════════════════
    # REACTION OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def add_reaction(
        self,
        post_id: int,
        reaction_data: ReactionCreate,
        user: AppUserDB
    ) -> Tuple[bool, Optional[str]]:
        """Add or update a reaction to a post."""
        post = await self.repo.get_post_by_id(post_id, include_author=False)
        if not post or post.is_deleted:
            return False, "Post not found"
        
        await self.repo.add_or_update_reaction(
            post_id, user.id, reaction_data.reaction_type
        )
        
        # Update author's reputation if upvoted
        if reaction_data.reaction_type == ReactionType.UPVOTE:
            await self.repo.increment_reputation(
                post.author_id,
                helpful_votes=1
            )
        
        return True, None
    
    async def remove_reaction(
        self,
        post_id: int,
        user: AppUserDB
    ) -> Tuple[bool, Optional[str]]:
        """Remove a reaction from a post."""
        success = await self.repo.remove_reaction(post_id, user.id)
        return success, None if success else "Reaction not found"
    
    # ═══════════════════════════════════════════════════════════════════════
    # BOOKMARK OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_user_bookmarks(
        self,
        user_id: UUID
    ) -> List[CommunityPostResponse]:
        """Get user's bookmarked posts."""
        posts = await self.repo.get_user_bookmarks(user_id)
        result = []
        for post in posts:
            post_response = await self._build_post_response(post, user_id)
            result.append(post_response)
        return result
    
    async def add_bookmark(
        self,
        post_id: int,
        user_id: UUID
    ) -> bool:
        """Bookmark a post."""
        post = await self.repo.get_post_by_id(post_id, include_author=False)
        if not post or post.is_deleted:
            return False
        return await self.repo.add_bookmark(post_id, user_id)
    
    async def remove_bookmark(
        self,
        post_id: int,
        user_id: UUID
    ) -> bool:
        """Remove a bookmark."""
        return await self.repo.remove_bookmark(post_id, user_id)
    
    # ═══════════════════════════════════════════════════════════════════════
    # REPUTATION OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_user_reputation(
        self,
        user_id: UUID
    ) -> Optional[UserReputationResponse]:
        """Get a user's reputation."""
        rep = await self.repo.get_or_create_reputation(user_id)
        
        win_rate = None
        if rep.total_trades_shared > 0:
            win_rate = (rep.winning_trades / rep.total_trades_shared) * 100
        
        return UserReputationResponse(
            user_id=rep.user_id,
            reputation_score=rep.reputation_score,
            helpful_votes=rep.helpful_votes,
            trade_accuracy=rep.trade_accuracy,
            total_trades_shared=rep.total_trades_shared,
            winning_trades=rep.winning_trades,
            losing_trades=rep.losing_trades,
            verified_trader=rep.verified_trader,
            community_role=rep.community_role,
            is_muted=rep.is_muted,
            win_rate=win_rate,
        )
    
    async def get_leaderboard(
        self,
        limit: int = 20,
        current_user_id: Optional[UUID] = None
    ) -> LeaderboardResponse:
        """Get reputation leaderboard."""
        entries = await self.repo.get_leaderboard(limit)
        
        result = []
        user_rank = None
        
        for rank, (rep, user) in enumerate(entries, 1):
            entry = LeaderboardEntry(
                rank=rank,
                user_id=user.id,
                username=user.username,
                profile_image=user.profile_image,
                reputation_score=rep.reputation_score,
                trade_accuracy=rep.trade_accuracy,
                verified_trader=rep.verified_trader,
            )
            result.append(entry)
            
            if current_user_id and user.id == current_user_id:
                user_rank = rank
        
        return LeaderboardResponse(
            entries=result,
            total_users=len(result),
            user_rank=user_rank,
        )
    
    async def verify_trader(
        self,
        user_id: UUID,
        admin_id: UUID
    ) -> Tuple[bool, Optional[str]]:
        """Verify a trader (admin only)."""
        rep = await self.repo.update_reputation(user_id, {
            'verified_trader': True,
            'community_role': DBCommunityRole.VERIFIED_TRADER,
        })
        
        if not rep:
            return False, "User not found"
        
        logger.info(f"User {user_id} verified as trader by admin {admin_id}")
        return True, None
    
    async def mute_user(
        self,
        user_id: UUID,
        duration_hours: int,
        reason: str,
        admin_id: UUID
    ) -> Tuple[bool, Optional[str]]:
        """Mute a user (admin only)."""
        rep = await self.repo.mute_user(user_id, duration_hours)
        
        if not rep:
            return False, "User not found"
        
        logger.info(f"User {user_id} muted for {duration_hours}h by admin {admin_id}: {reason}")
        return True, None
    
    async def unmute_user(
        self,
        user_id: UUID,
        admin_id: UUID
    ) -> Tuple[bool, Optional[str]]:
        """Unmute a user (admin only)."""
        rep = await self.repo.unmute_user(user_id)
        
        if not rep:
            return False, "User not found"
        
        logger.info(f"User {user_id} unmuted by admin {admin_id}")
        return True, None
    
    # ═══════════════════════════════════════════════════════════════════════
    # FEATURE REQUEST OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_feature_requests(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        current_user_id: Optional[UUID] = None
    ) -> Tuple[List[FeatureRequestResponse], int]:
        """Get paginated feature requests."""
        from app.schemas.community import FeatureStatus
        
        status_enum = None
        if status:
            try:
                status_enum = FeatureStatus(status)
            except ValueError:
                pass
        
        requests, total = await self.repo.get_feature_requests(
            page, page_size, status_enum
        )
        
        result = []
        for req in requests:
            user_voted = False
            if current_user_id:
                user_voted = await self.repo.has_user_voted(req.id, current_user_id)
            
            author_info = None
            if req.author:
                author_info = AuthorInfo(
                    id=req.author.id,
                    username=req.author.username,
                    profile_image=req.author.profile_image,
                    reputation_score=0,
                    verified_trader=False,
                    community_role=CommunityRole.USER,
                )
            
            result.append(FeatureRequestResponse(
                id=req.id,
                author_id=req.author_id,
                title=req.title,
                description=req.description,
                category=req.category,
                status=req.status,
                admin_response=req.admin_response,
                vote_count=req.vote_count,
                created_at=req.created_at,
                updated_at=req.updated_at,
                author=author_info,
                user_voted=user_voted,
            ))
        
        return result, total
    
    async def create_feature_request(
        self,
        data: FeatureRequestCreate,
        author: AppUserDB
    ) -> FeatureRequestResponse:
        """Create a feature request."""
        req = await self.repo.create_feature_request({
            'author_id': author.id,
            'title': data.title,
            'description': data.description,
            'category': data.category,
        })
        
        logger.info(f"Feature request created: {req.id} by {author.username}")
        
        return FeatureRequestResponse(
            id=req.id,
            author_id=req.author_id,
            title=req.title,
            description=req.description,
            category=req.category,
            status=req.status,
            admin_response=req.admin_response,
            vote_count=req.vote_count,
            created_at=req.created_at,
            updated_at=req.updated_at,
            author=AuthorInfo(
                id=author.id,
                username=author.username,
                profile_image=author.profile_image,
                reputation_score=0,
                verified_trader=False,
                community_role=CommunityRole.USER,
            ),
            user_voted=False,
        )
    
    async def vote_for_feature(
        self,
        request_id: int,
        user: AppUserDB
    ) -> Tuple[bool, str]:
        """Vote for a feature request."""
        return await self.repo.vote_for_feature(request_id, user.id)
    
    async def unvote_for_feature(
        self,
        request_id: int,
        user: AppUserDB
    ) -> bool:
        """Remove vote from a feature request."""
        return await self.repo.unvote_for_feature(request_id, user.id)


def get_community_service(db: AsyncSession) -> CommunityService:
    """Factory function for dependency injection."""
    return CommunityService(db)
