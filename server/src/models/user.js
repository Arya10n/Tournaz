import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    // Identity and Auth
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-z]+\.(ac\.in|edu\.in|edu)$/,
        'Please use a valid college email',
      ],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    collegeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      match: [/^[A-Z0-9]{8,12}$/, 'Invalid college ID format'],
    },

    // Personal Info
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      required: true,
      enum: ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'IT', 'Other'],
    },
    yearOfStudy: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    phoneNumber: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'],
    },

    // Role System
    primaryRole: {
      type: String,
      enum: ['student', 'team_captain', 'organizer', 'faculty', 'admin'],
      default: 'student',
    },
    secondaryRoles: [
      {
        type: String,
        enum: ['team_captain', 'score_reporter', 'co_organizer'],
      },
    ],

    // Organizer/Faculty Specific
    clubAssociation: {
      type: String,
      default: '',
    },
    facultyDepartment: {
      type: String,
      default: '',
    },
    isVerifiedOrganizer: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Student/Team Captain Specific
    teams: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        role: {
          type: String,
          enum: ['captain', 'co_captain', 'player', 'manager'],
        },
        joinedAt: Date,
      },
    ],
    isAvailableForSoloMatch: {
      type: Boolean,
      default: false,
    },

    // Platform Status & Verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    // Activity & Statistics
    lastLogin: Date,
    loginCount: {
      type: Number,
      default: 0,
    },
    tournamentsParticipated: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tournament',
        },
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
        },
        position: Number,
        participatedAt: Date,
      },
    ],
    totalMatchesPlayed: {
      type: Number,
      default: 0,
    },
    matchesWon: {
      type: Number,
      default: 0,
    },

    // Admin Management
    notes: [
      {
        content: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    warnings: {
      type: Number,
      default: 0,
    },
    restrictedUntil: Date,
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
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

// Virtual for win rate
userSchema.virtual('winRate').get(function () {
  if (this.totalMatchesPlayed === 0) return 0;
  return ((this.matchesWon / this.totalMatchesPlayed) * 100).toFixed(1);
});

// Virtual for checking if user can create tournaments
userSchema.virtual('canCreateTournaments').get(function () {
  return ['organizer', 'faculty', 'admin'].includes(this.primaryRole);
});

// Virtual for checking if user can manage brackets
userSchema.virtual('canManageBrackets').get(function () {
  return ['organizer', 'faculty', 'admin'].includes(this.primaryRole);
});

// Virtual for checking if user is currently restricted
userSchema.virtual('isRestricted').get(function () {
  return this.restrictedUntil && this.restrictedUntil > new Date();
});

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt timestamp
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has a specific role
userSchema.methods.hasRole = function (role) {
  return this.primaryRole === role || this.secondaryRoles.includes(role);
};

// Method to check if user has any of given roles
userSchema.methods.hasAnyRole = function (roles) {
  return (
    roles.includes(this.primaryRole) ||
    this.secondaryRoles.some(role => roles.includes(role))
  );
};

// Method to check if user is team captain of a specific team
userSchema.methods.isCaptainOfTeam = function (teamId) {
  return this.teams.some(
    t => t.team.toString() === teamId.toString() && t.role === 'captain'
  );
};

// Method to get user's display role (for UI)
userSchema.methods.getDisplayRole = function () {
  const roleMap = {
    student: 'Student',
    team_captain: 'Team Captain',
    organizer: 'Organizer',
    faculty: 'Faculty',
    admin: 'Admin',
    score_reporter: 'Score Reporter',
    co_organizer: 'Co-Organizer',
  };

  // Return primary role as main, but include secondary if relevant
  const display = roleMap[this.primaryRole] || 'Student';

  if (this.secondaryRoles.length > 0) {
    const secondary = this.secondaryRoles.map(r => roleMap[r]).join(', ');
    return `${display} (${secondary})`;
  }

  return display;
};

// Indexes for faster queries
// userSchema.index({ email: 1 });
// userSchema.index({ collegeId: 1 });
userSchema.index({ primaryRole: 1 });
userSchema.index({ department: 1, yearOfStudy: 1 });
userSchema.index({ 'teams.team': 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

export default User;
