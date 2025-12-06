import Tournament from '../models/tournament.js';

// Create Tournament
export const createTournament = async (req, res) => {
  try {
    const {
      name,
      description,
      game,
      tournamentType,
      registrationEnd,
      startDate,
      registrationType,
      maxTeams,
      teamSize,
      department,
      requiresFacultyApproval,
    } = req.body;

    // Validate organizer role
    if (!['organizer', 'faculty', 'admin'].includes(req.user.primaryRole)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create tournaments',
      });
    }

    // Create tournament
    const tournament = new Tournament({
      name,
      description,
      game,
      tournamentType,
      registrationEnd: new Date(registrationEnd),
      startDate: new Date(startDate),
      registrationType,
      maxTeams: maxTeams || 16,
      teamSize: teamSize || 5,
      department: department || 'All',
      requiresFacultyApproval: requiresFacultyApproval !== false,
      organizer: req.user.userId,
      status: requiresFacultyApproval === false ? 'registration_open' : 'draft',
    });

    await tournament.save();

    res.status(201).json({
      success: true,
      message: tournament.requiresFacultyApproval
        ? 'Tournament created successfully. Please wait for approval.'
        : 'Tournament created successfully.',
      data: { tournament },
    });
  } catch (error) {
    console.error('Create tournament error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create tournament',
    });
  }
};

// Get all tournaments
export const getTournaments = async (req, res) => {
  try {
    const {
      status,
      tournamentType,
      department,
      page = 1,
      limit = 10,
      search,
    } = req.query;

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    } else {
      // Default: only public tournaments
      query.status = { $in: ['registration_open', 'ongoing', 'completed'] };
    }

    // Filter by tournament type
    if (tournamentType) {
      query.tournamentType = tournamentType;
    }

    // Filter by department
    if (department && department !== 'All') {
      query.department = department;
    }

    // Search by name or game
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { game: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tournaments = await Tournament.find(query)
      .populate('organizer', 'fullName email collegeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tournament.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        tournaments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournaments',
    });
  }
};

// Get single tournaments
export const getTournament = async (req, res) => {
  try {
    // Get tournament by id
    const tournament = await Tournament.findById(req.params.id).populate(
      'organizer',
      'fullName email collegeId'
    );

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { tournament },
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournament',
    });
  }
};

// Update tournament
export const updateTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    // Check permissions
    const canManage = tournament.canUserManage(req.user);
    if (!canManage && req.user.primaryRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this tournament',
      });
    }

    // Prevent updates after registration starts
    if (
      tournament.status !== 'draft' &&
      tournament.status !== 'pending_approval'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update tournament after approval',
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name',
      'description',
      'game',
      'tournamentType',
      'registrationEnd',
      'startDate',
      'registrationType',
      'maxTeams',
      'teamSize',
      'department',
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        tournament[field] = req.body[field];
      }
    });

    // If faculty approval requirement changed
    if (req.body.requiresFacultyApproval !== undefined) {
      tournament.requiresFacultyApproval = req.body.requiresFacultyApproval;
      tournament.status = req.body.requiresFacultyApproval
        ? 'draft'
        : 'registration_open';
    }

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: { tournament },
    });
  } catch (error) {
    console.error('Update tournament error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update tournament',
    });
  }
};

// Submit for faculty approval
export const submitForApproval = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    //Check if user is organizer
    if (tournament.organizer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the organizer can submit for approval',
      });
    }

    // Check if already submitted
    if (tournament.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: `Tournament is already ${tournament.status}`,
      });
    }

    // Submit for approval
    tournament.status = 'pending_approval';
    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament submitted for faculty approval',
      data: { tournament },
    });
  } catch (error) {
    console.error('Submit for approval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit for approval',
    });
  }
};

// Faculty approve tournament
export const approveTournament = async (req, res) => {
  try {
    // Only faculty can approve
    if (req.user.primaryRole !== 'faculty') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to approve tournaments',
      });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    // Check if can be approved
    if (tournament.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: 'Tournament is not pending approval',
      });
    }

    // Approve the tournament
    tournament.status = 'registration_open';
    tournament.approvalStatus = {
      approved: true,
      approvedBy: req.user.userId,
      approvedAt: new Date(),
    };

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament approved successfully',
      data: { tournament },
    });
  } catch (error) {
    console.error('Approve tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve tournament',
    });
  }
};

// Faculty reject tournament
export const rejectTournament = async (req, res) => {
  try {
    // Only faculty can reject
    if (req.user.primaryRole !== 'faculty') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to reject tournaments',
      });
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason must be at least 10 characters',
      });
    }

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    // Check if can be rejected
    if (tournament.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        error: 'Tournament is not pending approval',
      });
    }

    // Reject the tournament
    tournament.status = 'rejected';
    tournament.approvalStatus = {
      approved: false,
      approvedBy: req.user.userId,
      approvedAt: new Date(),
      rejectionReason,
    };
    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament rejected',
      data: { tournament },
    });
  } catch (error) {
    console.error('Reject tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject tournament',
    });
  }
};

// Delete Tournament
export const deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
    }

    // Check permissions - organizer or admin
    const canManage = tournament.canUserManage(req.user);
    if (!canManage && req.user.primaryRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this tournament',
      });
    }

    // Prevent deletion if tournament has started
    if (
      tournament.status !== 'draft' &&
      tournament.status !== 'pending_approval'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete tournament after approval',
      });
    }

    await tournament.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tournament',
    });
  }
};

// Get tournaments needing approval
export const getPendingApprovals = async (req, res) => {
  try {
    // Only faculty can see pending approvals
    if (req.user.primaryRole !== 'faculty') {
      return res.status(403).json({
        success: false,
        error: 'Only faculty can view pending approvals',
      });
    }

    const tournaments = await Tournament.find({
      status: 'pending_approval',
      requiresFacultyApproval: true,
    })
      .populate('organizer', 'fullName email collegeId department')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { tournaments },
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending approvals',
    });
  }
};
