import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema(
  {
    // Tournament Info
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    game: {
      type: String,
      required: true,
      trim: true,
    },

    // Tournament Type
    tournamentType: {
      type: String,
      required: true,
      enum: [
        'single-elimination',
        'double-elimination',
        'round-robin',
        'swiss',
      ],
      default: 'single-elimination',
    },

    // Dates
    registrationStart: Date,
    registrationEnd: {
      type: Date,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    // Faculty Approval Status
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'registration_open',
        'registration_closed',
        'ongoing',
        'completed',
        'cancelled',
        'rejected',
      ],
      default: 'draft',
    },

    approvalStatus: {
      approved: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      rejectionReason: String,
    },

    // Organizer
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    requiresFacultyApproval: {
      type: Boolean,
      default: true,
    },

    // Registration Types
    registrationType: {
      type: String,
      enum: ['team', 'solo', 'hybrid'],
      default: 'team',
    },

    // Team Config
    maxTeams: {
      type: Number,
      required: true,
      min: 2,
      max: 64,
      default: 16,
    },

    teamSize: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 5,
    },

    // Participants
    registeredTeams: [
      {
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registeredAt: { type: Date, default: Date.now },
        approved: { type: Boolean, default: false },
      },
    ],

    soloPlayers: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registeredAt: { type: Date, default: Date.now },
        matched: { type: Boolean, default: false },
      },
    ],

    // Bracket
    bracketGenerated: {
      type: Boolean,
      default: false,
    },

    bracket: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // For round-robin/swiss
    rounds: [
      {
        roundNumber: Number,
        matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
        completed: { type: Boolean, default: false },
      },
    ],

    // Results
    winner: {
      team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      declaredAt: Date,
    },

    // College Specific
    department: {
      type: String,
      enum: ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'IT', 'Other', 'All'],
      default: 'All',
    },

    yearRestriction: {
      enabled: { type: Boolean, default: false },
      allowedYears: [{ type: Number, min: 1, max: 5 }],
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual Properties
tournamentSchema.virtual('isRegistrationOpen').get(function () {
  const now = new Date();
  if (this.registrationStart && this.registrationEnd) {
    return now >= this.registrationStart && now <= this.registrationEnd;
  }
  return now <= this.registrationEnd;
});

tournamentSchema.virtual('canRegister').get(function () {
  return this.status === 'registration_open' && this.isRegistrationOpen;
});

tournamentSchema.virtual('teamCount').get(function () {
  return this.registeredTeams.length;
});

tournamentSchema.virtual('soloCount').get(function () {
  return this.soloPlayers.length;
});

tournamentSchema.virtual('totalParticipants').get(function () {
  return this.teamCount + this.soloCount;
});

tournamentSchema.virtual('isFull').get(function () {
  return this.registeredTeams.length >= this.maxTeams;
});

tournamentSchema.virtual('needsApproval').get(function () {
  return this.status === 'pending_approval' && this.requiresFacultyApproval;
});

// Methods
tournamentSchema.methods.canUserManage = function (user) {
  // Organizer, faculty approver, or admin
  const isOrganizer = this.organizer.toString() === user.userId.toString();
  const isFacultyApprover =
    this.approvalStatus.approvedBy &&
    this.approvalStatus.approvedBy.toString() === user.userId.toString();

  return isOrganizer || isFacultyApprover || user.primaryRole === 'admin';
};

tournamentSchema.methods.canApprove = function (user) {
  // Only faculty can approve tournaments
  return user.primaryRole === 'faculty' && this.status === 'pending_approval';
};

tournamentSchema.methods.submitForApproval = async function () {
  if (this.requiresFacultyApproval && this.status === 'draft') {
    this.status = 'pending_approval';
    await this.save();
    // TODO: Notify faculty
  }
};

tournamentSchema.methods.approveTournament = async function (facultyUserId) {
  if (this.status === 'pending_approval') {
    this.status = 'registration_open';
    this.approvalStatus = {
      approved: true,
      approvedBy: facultyUserId,
      approvedAt: new Date(),
    };
    await this.save();
  }
};

tournamentSchema.methods.rejectTournament = async function (
  facultyUserId,
  reason
) {
  if (this.status === 'pending_approval') {
    this.status = 'rejected';
    this.approvalStatus = {
      approved: false,
      approvedBy: facultyUserId,
      approvedAt: new Date(),
      rejectionReason: reason,
    };
    await this.save();
  }
};

tournamentSchema.methods.registerTeam = function (teamId, captainId) {
  if (this.isFull || !this.canRegister) {
    throw new Error('Cannot register team');
  }

  this.registeredTeams.push({
    team: teamId,
    captain: captainId,
    registeredAt: new Date(),
    approved: this.registrationType !== 'team',
  });
};

tournamentSchema.methods.registerSolo = function (userId) {
  if (!this.canRegister || this.registrationType === 'team') {
    throw new Error('Solo registration not allowed');
  }

  this.soloPlayers.push({
    player: userId,
    registeredAt: new Date(),
    matched: false,
  });
};

// Static Methods
tournamentSchema.statics.findNeedApproval = function (facultyUserId) {
  return this.find({
    status: 'pending_approval',
    requiresFacultyApproval: true,
  });
};

tournamentSchema.statics.findByOrganizer = function (organizerId) {
  return this.find({ organizer: organizerId });
};

tournamentSchema.statics.findPublic = function () {
  return this.find({
    status: { $in: ['registration_open', 'ongoing', 'completed'] },
  });
};

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament;
