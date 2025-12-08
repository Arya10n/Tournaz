import express from 'express';
import {
  approveTournament,
  createTournament,
  deleteTournament,
  getPendingApprovals,
  getTournament,
  getTournaments,
  rejectTournament,
  submitForApproval,
  updateTournament,
} from '../controllers/tournamentController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  canApproveTournament,
  canManageTournament,
  requireFaculty,
  requireOrganizer,
} from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Public Routes
router.get('/', getTournaments);
router.get('/:id', getTournament);

// Protected Routes
// All routes below require authentication
router.use(requireAuth);

router.post('/', requireOrganizer, createTournament);
router.put('/:id', canManageTournament, updateTournament);
router.delete('/:id', canManageTournament, deleteTournament);
router.post('/:id/submit', canManageTournament, submitForApproval);

// Faculty routes
router.get('/pending/approvals', requireFaculty, getPendingApprovals);
router.post('/:id/approve', canApproveTournament, approveTournament);
router.post('/:id/reject', canApproveTournament, rejectTournament);

// Organizer routes
router.get('/organizer/my-tournaments', requireOrganizer, async (req, res) => {
  try {
    const Tournament = (await import('../models/tournament.js')).default;
    const tournaments = await Tournament.findByOrganizer(req.user.userId)
      .populate('organizer', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { tournaments },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your tournaments',
    });
  }
});

export default router;
