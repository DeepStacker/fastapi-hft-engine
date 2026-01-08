"""
Community Repository - Database operations for community module.

Provides CRUD operations and specialized queries for:
- Community rooms
- Posts and threads
- Reactions
- User reputation
- Signal threads
- Feature requests
"""
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timedelta

from sqlalchemy import select, func, and_, or_, desc, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from core.database.community_models import (
    CommunityRoomDB,
    CommunityPostDB,
    CommunityReactionDB,
    UserReputationDB,
    SignalThreadDB,
    FeatureRequestDB,
    FeatureVoteDB,
    RoomType,
    ReactionType,
    SignalOutcome,
    FeatureStatus,
    CommunityRole,
)
from core.database.models import AppUserDB

import logging

logger = logging.getLogger(__name__)


class CommunityRepository:
    """Repository for community module database operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # ═══════════════════════════════════════════════════════════════════════
    # ROOM OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_all_rooms(self, active_only: bool = True) -> List[CommunityRoomDB]:
        """Get all community rooms."""
        query = select(CommunityRoomDB)
        if active_only:
            query = query.where(CommunityRoomDB.is_active == True)
        query = query.order_by(CommunityRoomDB.created_at)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_room_by_slug(self, slug: str) -> Optional[CommunityRoomDB]:
        """Get a room by its slug."""
        result = await self.db.execute(
            select(CommunityRoomDB).where(func.lower(CommunityRoomDB.slug) == slug.lower())
        )
        return result.scalar_one_or_none()
    
    async def get_room_by_id(self, room_id: int) -> Optional[CommunityRoomDB]:
        """Get a room by its ID."""
        result = await self.db.execute(
            select(CommunityRoomDB).where(CommunityRoomDB.id == room_id)
        )
        return result.scalar_one_or_none()
    
    async def create_room(self, room_data: dict) -> CommunityRoomDB:
        """Create a new community room."""
        room = CommunityRoomDB(**room_data)
        self.db.add(room)
        await self.db.flush()
        await self.db.refresh(room)
        return room
    
    async def update_room(self, room_id: int, room_data: dict) -> Optional[CommunityRoomDB]:
        """Update a room."""
        room = await self.get_room_by_id(room_id)
        if not room:
            return None
        
        for key, value in room_data.items():
            if value is not None and hasattr(room, key):
                setattr(room, key, value)
        
        await self.db.flush()
        await self.db.refresh(room)
        return room
    
    async def get_room_post_count(self, room_id: int) -> int:
        """Get the number of posts in a room."""
        result = await self.db.execute(
            select(func.count()).select_from(CommunityPostDB).where(
                and_(
                    CommunityPostDB.room_id == room_id,
                    CommunityPostDB.is_deleted == False,
                    CommunityPostDB.parent_post_id == None  # Root posts only
                )
            )
        )
        return result.scalar() or 0
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_posts_in_room(
        self,
        room_id: int,
        page: int = 1,
        page_size: int = 20,
        include_replies: bool = False
    ) -> Tuple[List[CommunityPostDB], int]:
        """Get paginated posts in a room."""
        # Base query for root posts
        base_query = select(CommunityPostDB).where(
            and_(
                CommunityPostDB.room_id == room_id,
                CommunityPostDB.is_deleted == False
            )
        )
        
        if not include_replies:
            base_query = base_query.where(CommunityPostDB.parent_post_id == None)
        
        # Count total
        count_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = count_result.scalar() or 0
        
        # Get paginated results
        query = base_query.options(
            joinedload(CommunityPostDB.author)
        ).order_by(
            desc(CommunityPostDB.is_pinned),
            desc(CommunityPostDB.created_at)
        ).offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        posts = list(result.scalars().unique().all())
        
        return posts, total
    
    async def get_post_by_id(
        self,
        post_id: int,
        include_author: bool = True
    ) -> Optional[CommunityPostDB]:
        """Get a post by ID."""
        query = select(CommunityPostDB).where(CommunityPostDB.id == post_id)
        
        if include_author:
            query = query.options(joinedload(CommunityPostDB.author))
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_post_replies(
        self,
        post_id: int,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[CommunityPostDB], int]:
        """Get replies to a post."""
        base_query = select(CommunityPostDB).where(
            and_(
                CommunityPostDB.parent_post_id == post_id,
                CommunityPostDB.is_deleted == False
            )
        )
        
        # Count
        count_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = count_result.scalar() or 0
        
        # Get paginated
        query = base_query.options(
            joinedload(CommunityPostDB.author)
        ).order_by(
            CommunityPostDB.created_at
        ).offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        replies = list(result.scalars().unique().all())
        
        return replies, total
    
    async def create_post(self, post_data: dict) -> CommunityPostDB:
        """Create a new post."""
        post = CommunityPostDB(**post_data)
        self.db.add(post)
        await self.db.flush()
        await self.db.refresh(post)
        
        # Update parent's reply count if this is a reply
        if post.parent_post_id:
            await self.db.execute(
                update(CommunityPostDB)
                .where(CommunityPostDB.id == post.parent_post_id)
                .values(reply_count=CommunityPostDB.reply_count + 1)
            )
        
        return post
    
    async def update_post(self, post_id: int, post_data: dict) -> Optional[CommunityPostDB]:
        """Update a post."""
        post = await self.get_post_by_id(post_id, include_author=False)
        if not post:
            return None
        
        for key, value in post_data.items():
            if value is not None and hasattr(post, key):
                setattr(post, key, value)
        
        post.is_edited = True
        post.updated_at = datetime.utcnow()
        
        await self.db.flush()
        await self.db.refresh(post)
        return post
    
    async def delete_post(self, post_id: int, soft_delete: bool = True) -> bool:
        """Delete a post (soft delete by default)."""
        post = await self.get_post_by_id(post_id, include_author=False)
        if not post:
            return False
        
        if soft_delete:
            post.is_deleted = True
            await self.db.flush()
        else:
            await self.db.delete(post)
            await self.db.flush()
        
        # Update parent's reply count if this was a reply
        if post.parent_post_id:
            await self.db.execute(
                update(CommunityPostDB)
                .where(CommunityPostDB.id == post.parent_post_id)
                .values(reply_count=CommunityPostDB.reply_count - 1)
            )
        
        return True
    
    async def pin_post(self, post_id: int, is_pinned: bool) -> Optional[CommunityPostDB]:
        """Pin or unpin a post."""
        return await self.update_post(post_id, {"is_pinned": is_pinned})
    
    async def get_user_last_post_time(self, user_id: UUID, room_id: int) -> Optional[datetime]:
        """Get the timestamp of user's last post in a room."""
        result = await self.db.execute(
            select(CommunityPostDB.created_at)
            .where(
                and_(
                    CommunityPostDB.author_id == user_id,
                    CommunityPostDB.room_id == room_id,
                    CommunityPostDB.is_deleted == False
                )
            )
            .order_by(desc(CommunityPostDB.created_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row
    
    # ═══════════════════════════════════════════════════════════════════════
    # REACTION OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_user_reaction(
        self,
        post_id: int,
        user_id: UUID
    ) -> Optional[CommunityReactionDB]:
        """Get a user's reaction to a post."""
        result = await self.db.execute(
            select(CommunityReactionDB).where(
                and_(
                    CommunityReactionDB.post_id == post_id,
                    CommunityReactionDB.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def add_or_update_reaction(
        self,
        post_id: int,
        user_id: UUID,
        reaction_type: ReactionType
    ) -> CommunityReactionDB:
        """Add or update a reaction (upsert)."""
        existing = await self.get_user_reaction(post_id, user_id)
        
        old_type = existing.reaction_type if existing else None
        
        if existing:
            existing.reaction_type = reaction_type
            await self.db.flush()
            await self.db.refresh(existing)
            reaction = existing
        else:
            reaction = CommunityReactionDB(
                post_id=post_id,
                user_id=user_id,
                reaction_type=reaction_type
            )
            self.db.add(reaction)
            await self.db.flush()
            await self.db.refresh(reaction)
        
        # Update post vote counts
        await self._update_post_vote_counts(post_id, old_type, reaction_type)
        
        return reaction
    
    async def remove_reaction(self, post_id: int, user_id: UUID) -> bool:
        """Remove a reaction."""
        reaction = await self.get_user_reaction(post_id, user_id)
        if not reaction:
            return False
        
        old_type = reaction.reaction_type
        await self.db.delete(reaction)
        await self.db.flush()
        
        # Update post vote counts
        await self._update_post_vote_counts(post_id, old_type, None)
        
        return True
    
    async def _update_post_vote_counts(
        self,
        post_id: int,
        old_type: Optional[ReactionType],
        new_type: Optional[ReactionType]
    ):
        """Update denormalized vote counts on post."""
        upvote_delta = 0
        downvote_delta = 0
        
        # Remove old reaction count
        if old_type == ReactionType.UPVOTE:
            upvote_delta -= 1
        elif old_type == ReactionType.DOWNVOTE:
            downvote_delta -= 1
        
        # Add new reaction count
        if new_type == ReactionType.UPVOTE:
            upvote_delta += 1
        elif new_type == ReactionType.DOWNVOTE:
            downvote_delta += 1
        
        if upvote_delta != 0 or downvote_delta != 0:
            await self.db.execute(
                update(CommunityPostDB)
                .where(CommunityPostDB.id == post_id)
                .values(
                    upvotes=CommunityPostDB.upvotes + upvote_delta,
                    downvotes=CommunityPostDB.downvotes + downvote_delta
                )
            )
    
    async def get_reaction_summary(self, post_id: int) -> dict:
        """Get aggregated reaction counts for a post."""
        result = await self.db.execute(
            select(
                CommunityReactionDB.reaction_type,
                func.count().label('count')
            )
            .where(CommunityReactionDB.post_id == post_id)
            .group_by(CommunityReactionDB.reaction_type)
        )
        
        summary = {
            'upvotes': 0,
            'downvotes': 0,
            'confirms': 0,
            'disagrees': 0,
            'neutrals': 0,
            'total': 0
        }
        
        for row in result:
            rtype, count = row
            summary['total'] += count
            if rtype == ReactionType.UPVOTE:
                summary['upvotes'] = count
            elif rtype == ReactionType.DOWNVOTE:
                summary['downvotes'] = count
            elif rtype == ReactionType.CONFIRM:
                summary['confirms'] = count
            elif rtype == ReactionType.DISAGREE:
                summary['disagrees'] = count
            elif rtype == ReactionType.NEUTRAL:
                summary['neutrals'] = count
        
        return summary
    
    # ═══════════════════════════════════════════════════════════════════════
    # BOOKMARK OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_user_bookmarks(self, user_id: UUID) -> List[CommunityPostDB]:
        """Get user's bookmarked posts."""
        # Using reactions with a special 'bookmark' type stored differently
        # For simplicity, store bookmarks in reactions with CONFIRM type marked specially
        # Or just use a subquery approach with a bookmark marker
        result = await self.db.execute(
            select(CommunityPostDB)
            .join(CommunityReactionDB, CommunityReactionDB.post_id == CommunityPostDB.id)
            .options(joinedload(CommunityPostDB.author))
            .where(
                and_(
                    CommunityReactionDB.user_id == user_id,
                    CommunityReactionDB.reaction_type == ReactionType.CONFIRM,  # Using CONFIRM as bookmark marker
                    CommunityPostDB.is_deleted == False
                )
            )
            .order_by(desc(CommunityReactionDB.created_at))
        )
        return list(result.scalars().unique().all())
    
    async def add_bookmark(self, post_id: int, user_id: UUID) -> bool:
        """Add a bookmark (using CONFIRM reaction type as marker)."""
        existing = await self.get_user_reaction(post_id, user_id)
        if existing and existing.reaction_type == ReactionType.CONFIRM:
            return True  # Already bookmarked
        
        # For now, add a CONFIRM reaction as bookmark marker
        # In production, you'd want a separate bookmarks table
        if existing:
            existing.reaction_type = ReactionType.CONFIRM
            await self.db.flush()
        else:
            bookmark = CommunityReactionDB(
                post_id=post_id,
                user_id=user_id,
                reaction_type=ReactionType.CONFIRM
            )
            self.db.add(bookmark)
            await self.db.flush()
        return True
    
    async def remove_bookmark(self, post_id: int, user_id: UUID) -> bool:
        """Remove a bookmark."""
        existing = await self.get_user_reaction(post_id, user_id)
        if existing and existing.reaction_type == ReactionType.CONFIRM:
            await self.db.delete(existing)
            await self.db.flush()
            return True
        return False
    
    # ═══════════════════════════════════════════════════════════════════════
    # REPUTATION OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_user_reputation(self, user_id: UUID) -> Optional[UserReputationDB]:
        """Get user's reputation record."""
        result = await self.db.execute(
            select(UserReputationDB).where(UserReputationDB.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_or_create_reputation(self, user_id: UUID) -> UserReputationDB:
        """Get or create a user's reputation record."""
        rep = await self.get_user_reputation(user_id)
        if rep:
            return rep
        
        rep = UserReputationDB(user_id=user_id)
        self.db.add(rep)
        await self.db.flush()
        await self.db.refresh(rep)
        return rep
    
    async def update_reputation(
        self,
        user_id: UUID,
        updates: dict
    ) -> Optional[UserReputationDB]:
        """Update user reputation."""
        rep = await self.get_or_create_reputation(user_id)
        
        for key, value in updates.items():
            if value is not None and hasattr(rep, key):
                setattr(rep, key, value)
        
        rep.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(rep)
        return rep
    
    async def increment_reputation(
        self,
        user_id: UUID,
        helpful_votes: int = 0,
        winning_trades: int = 0,
        losing_trades: int = 0
    ) -> Optional[UserReputationDB]:
        """Increment reputation counters."""
        rep = await self.get_or_create_reputation(user_id)
        
        if helpful_votes:
            rep.helpful_votes += helpful_votes
        if winning_trades:
            rep.winning_trades += winning_trades
            rep.total_trades_shared += winning_trades
        if losing_trades:
            rep.losing_trades += losing_trades
            rep.total_trades_shared += losing_trades
            rep.consecutive_losses += losing_trades
        
        # Recalculate accuracy
        if rep.total_trades_shared > 0:
            rep.trade_accuracy = (rep.winning_trades / rep.total_trades_shared) * 100
        
        rep.reputation_score = rep.calculate_score()
        rep.updated_at = datetime.utcnow()
        
        await self.db.flush()
        await self.db.refresh(rep)
        return rep
    
    async def get_leaderboard(
        self,
        limit: int = 20,
        verified_only: bool = False
    ) -> List[Tuple[UserReputationDB, AppUserDB]]:
        """Get reputation leaderboard."""
        query = (
            select(UserReputationDB, AppUserDB)
            .join(AppUserDB, UserReputationDB.user_id == AppUserDB.id)
            .where(UserReputationDB.is_muted == False)
        )
        
        if verified_only:
            query = query.where(UserReputationDB.verified_trader == True)
        
        query = query.order_by(desc(UserReputationDB.reputation_score)).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.all())
    
    async def mute_user(
        self,
        user_id: UUID,
        duration_hours: int
    ) -> Optional[UserReputationDB]:
        """Mute a user for specified duration."""
        muted_until = datetime.utcnow() + timedelta(hours=duration_hours)
        return await self.update_reputation(user_id, {
            'is_muted': True,
            'muted_until': muted_until
        })
    
    async def unmute_user(self, user_id: UUID) -> Optional[UserReputationDB]:
        """Unmute a user."""
        return await self.update_reputation(user_id, {
            'is_muted': False,
            'muted_until': None
        })
    
    async def check_user_can_post(
        self,
        user_id: UUID,
        room_id: int
    ) -> Tuple[bool, Optional[str]]:
        """Check if user can post (cooldowns, mutes, etc.)."""
        rep = await self.get_user_reputation(user_id)
        room = await self.get_room_by_id(room_id)
        
        if not room:
            return False, "Room not found"
        
        if rep:
            # Check if muted
            if rep.is_muted:
                if rep.muted_until and rep.muted_until > datetime.utcnow():
                    return False, f"You are muted until {rep.muted_until}"
                else:
                    # Auto-unmute if time has passed
                    await self.unmute_user(user_id)
            
            # Check reputation requirement
            if rep.reputation_score < room.min_reputation_to_post:
                return False, f"Minimum reputation of {room.min_reputation_to_post} required"
            
            # Check cooldown
            if room.post_cooldown_seconds > 0:
                last_post = await self.get_user_last_post_time(user_id, room_id)
                if last_post:
                    cooldown_end = last_post + timedelta(seconds=room.post_cooldown_seconds)
                    if datetime.utcnow() < cooldown_end:
                        remaining = (cooldown_end - datetime.utcnow()).seconds
                        return False, f"Please wait {remaining} seconds before posting again"
        
        return True, None
    
    # ═══════════════════════════════════════════════════════════════════════
    # SIGNAL THREAD OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_signal_thread(self, signal_id: int) -> Optional[SignalThreadDB]:
        """Get signal thread by signal ID."""
        result = await self.db.execute(
            select(SignalThreadDB)
            .options(joinedload(SignalThreadDB.post))
            .where(SignalThreadDB.signal_id == signal_id)
        )
        return result.scalar_one_or_none()
    
    async def create_signal_thread(
        self,
        signal_id: int,
        market_snapshot: dict,
        post_id: Optional[int] = None
    ) -> SignalThreadDB:
        """Create a signal thread."""
        thread = SignalThreadDB(
            signal_id=signal_id,
            post_id=post_id,
            market_snapshot=market_snapshot
        )
        self.db.add(thread)
        await self.db.flush()
        await self.db.refresh(thread)
        return thread
    
    async def update_signal_outcome(
        self,
        signal_id: int,
        outcome: SignalOutcome,
        outcome_pnl: Optional[float] = None
    ) -> Optional[SignalThreadDB]:
        """Update signal outcome after expiry."""
        thread = await self.get_signal_thread(signal_id)
        if not thread:
            return None
        
        thread.outcome = outcome
        thread.outcome_pnl = outcome_pnl
        thread.resolved_at = datetime.utcnow()
        
        await self.db.flush()
        await self.db.refresh(thread)
        return thread
    
    async def add_signal_reaction(
        self,
        signal_id: int,
        sentiment: str  # 'bullish', 'bearish', 'neutral'
    ) -> Optional[SignalThreadDB]:
        """Add a reaction to a signal."""
        thread = await self.get_signal_thread(signal_id)
        if not thread:
            return None
        
        if sentiment == 'bullish':
            thread.bullish_reactions += 1
        elif sentiment == 'bearish':
            thread.bearish_reactions += 1
        else:
            thread.neutral_reactions += 1
        
        await self.db.flush()
        await self.db.refresh(thread)
        return thread
    
    # ═══════════════════════════════════════════════════════════════════════
    # FEATURE REQUEST OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    async def get_feature_requests(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[FeatureStatus] = None
    ) -> Tuple[List[FeatureRequestDB], int]:
        """Get paginated feature requests."""
        base_query = select(FeatureRequestDB)
        
        if status:
            base_query = base_query.where(FeatureRequestDB.status == status)
        
        # Count
        count_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = count_result.scalar() or 0
        
        # Get paginated
        query = base_query.options(
            joinedload(FeatureRequestDB.author)
        ).order_by(
            desc(FeatureRequestDB.vote_count),
            desc(FeatureRequestDB.created_at)
        ).offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        requests = list(result.scalars().unique().all())
        
        return requests, total
    
    async def get_feature_request_by_id(
        self,
        request_id: int
    ) -> Optional[FeatureRequestDB]:
        """Get a feature request by ID."""
        result = await self.db.execute(
            select(FeatureRequestDB)
            .options(joinedload(FeatureRequestDB.author))
            .where(FeatureRequestDB.id == request_id)
        )
        return result.scalar_one_or_none()
    
    async def create_feature_request(self, data: dict) -> FeatureRequestDB:
        """Create a new feature request."""
        request = FeatureRequestDB(**data)
        self.db.add(request)
        await self.db.flush()
        await self.db.refresh(request)
        return request
    
    async def update_feature_request(
        self,
        request_id: int,
        data: dict
    ) -> Optional[FeatureRequestDB]:
        """Update a feature request."""
        request = await self.get_feature_request_by_id(request_id)
        if not request:
            return None
        
        for key, value in data.items():
            if value is not None and hasattr(request, key):
                setattr(request, key, value)
        
        request.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(request)
        return request
    
    async def vote_for_feature(
        self,
        request_id: int,
        user_id: UUID
    ) -> Tuple[bool, str]:
        """Vote for a feature request."""
        # Check if already voted
        existing = await self.db.execute(
            select(FeatureVoteDB).where(
                and_(
                    FeatureVoteDB.feature_request_id == request_id,
                    FeatureVoteDB.user_id == user_id
                )
            )
        )
        if existing.scalar_one_or_none():
            return False, "Already voted"
        
        # Add vote
        vote = FeatureVoteDB(
            feature_request_id=request_id,
            user_id=user_id
        )
        self.db.add(vote)
        
        # Increment count
        await self.db.execute(
            update(FeatureRequestDB)
            .where(FeatureRequestDB.id == request_id)
            .values(vote_count=FeatureRequestDB.vote_count + 1)
        )
        
        await self.db.flush()
        return True, "Vote recorded"
    
    async def unvote_for_feature(
        self,
        request_id: int,
        user_id: UUID
    ) -> bool:
        """Remove vote from a feature request."""
        result = await self.db.execute(
            delete(FeatureVoteDB).where(
                and_(
                    FeatureVoteDB.feature_request_id == request_id,
                    FeatureVoteDB.user_id == user_id
                )
            )
        )
        
        if result.rowcount > 0:
            await self.db.execute(
                update(FeatureRequestDB)
                .where(FeatureRequestDB.id == request_id)
                .values(vote_count=FeatureRequestDB.vote_count - 1)
            )
            await self.db.flush()
            return True
        
        return False
    
    async def has_user_voted(
        self,
        request_id: int,
        user_id: UUID
    ) -> bool:
        """Check if user has voted for a feature request."""
        result = await self.db.execute(
            select(func.count()).select_from(FeatureVoteDB).where(
                and_(
                    FeatureVoteDB.feature_request_id == request_id,
                    FeatureVoteDB.user_id == user_id
                )
            )
        )
        return (result.scalar() or 0) > 0


def get_community_repository(db: AsyncSession) -> CommunityRepository:
    """Factory function for dependency injection."""
    return CommunityRepository(db)
