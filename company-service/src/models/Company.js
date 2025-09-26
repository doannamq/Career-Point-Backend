import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
    trim: true,
  },
  ward: {
    type: String,
    required: true,
    trim: true,
  },
  district: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  // country: {
  //   type: String,
  //   required: true,
  //   trim: true,
  //   default: "",
  // },
});

const contactSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email không hợp lệ"],
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, "Website phải bắt đầu với http:// hoặc https://"],
  },
});

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.status === "active";
    },
  },
  userName: {
    type: String,
    trim: true,
    required: function () {
      return this.status === "active";
    },
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email không hợp lệ"],
  },
  role: {
    type: String,
    enum: ["admin_company", "hr_manager", "recruiter"],
    default: "recruiter",
  },
  permissions: [
    {
      type: String,
      enum: [
        "create_jobs",
        "edit_jobs",
        "delete_jobs",
        "view_applications",
        "manage_applications",
        "manage_company",
        "manage_members",
        "view_analytics",
      ],
    },
  ],
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["active", "pending", "suspended"],
    default: "pending",
  },
});

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên công ty là bắt buộc"],
      trim: true,
      maxlength: [200, "Tên công ty không được vượt quá 200 ký tự"],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    businessCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    taxCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    industry: {
      type: String,
      required: [true, "Ngành nghề là bắt buộc"],
      enum: [
        "Information Technology",
        "Software Development",
        "E-commerce",
        "Digital Marketing",
        "Finance & Banking",
        "Healthcare",
        "Education & Training",
        "Manufacturing",
        "Retail & Consumer Goods",
        "Construction & Real Estate",
        "Transportation & Logistics",
        "Food & Beverage",
        "Tourism & Hospitality",
        "Media & Entertainment",
        "Consulting",
        "Government & Public Sector",
        "Non-profit",
        "Other",
      ],
    },

    companySize: {
      type: String,
      required: true,
      enum: [
        "1-10 employees",
        "11-50 employees",
        "51-200 employees",
        "201-500 employees",
        "501-1000 employees",
        "1000+ employees",
      ],
    },

    companyType: {
      type: String,
      required: true,
      enum: [
        "Limited Liability Company",
        "Joint Stock Company",
        "Sole Proprietorship",
        "100% Foreign-Owned Company",
        "Joint Venture",
        "Representative Office",
        "Branch",
        "Other",
      ],
      default: "Limited Liability Company",
    },

    description: {
      type: String,
      maxlength: [2000, "Mô tả không được vượt quá 2000 ký tự"],
    },

    foundedYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
      validate: {
        validator: function (year) {
          return year <= new Date().getFullYear();
        },
        message: "Năm thành lập không thể ở tương lai",
      },
    },

    address: {
      type: addressSchema,
      required: true,
    },

    contact: {
      type: contactSchema,
      required: true,
    },

    logo: {
      type: String,
      match: [/^https?:\/\/.+/, "Logo phải là URL hợp lệ"],
      required: false,
    },

    coverImage: {
      type: String,
      match: [/^https?:\/\/.+/, "Cover image phải là URL hợp lệ"],
      required: false,
    },

    socialMedia: {
      facebook: String,
      linkedin: String,
      twitter: String,
      instagram: String,
    },

    members: [memberSchema],

    stats: {
      totalJobs: {
        type: Number,
        default: 0,
      },
      activeJobs: {
        type: Number,
        default: 0,
      },
      totalApplications: {
        type: Number,
        default: 0,
      },
      profileViews: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending_verification"],
      default: "pending_verification",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationDate: {
      type: Date,
    },

    verificationDocuments: [
      {
        name: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["Business License", "Tax Certificate", "Investment Certificate", "Other"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        uploadDate: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
      },
    ],

    subscription: {
      plan: {
        type: String,
        enum: ["free", "basic", "premium", "enterprise"],
        default: "free",
      },
      billingCycle: {
        type: String,
        enum: ["monthly", "annually"],
        default: "monthly",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
      },
      jobPostLimit: {
        type: Number,
        default: 3,
      },
      featuredJobsLimit: {
        type: Number,
        default: 0,
      },
    },

    subscriptionHistory: [
      {
        plan: { type: String, enum: ["free", "basic", "premium", "enterprise"], required: true },
        billingCycle: { type: String, enum: ["monthly", "annually"], required: true },
        amount: { type: Number, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        purchasedAt: { type: Date, default: Date.now },
        transactionId: { type: String },
        status: { type: String, enum: ["success", "failed"], default: "success" },
      },
    ],

    recruitmentContact: {
      name: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email không hợp lệ"],
      },
      phone: {
        type: String,
        trim: true,
      },
    },

    benefits: [
      {
        type: String,
        trim: true,
      },
    ],

    workingHours: {
      type: String,
      trim: true,
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    lastActivity: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

companySchema.index({ name: "text", description: "text" });
// companySchema.index({ slug: 1 });
// companySchema.index({ businessCode: 1 });
// companySchema.index({ taxCode: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ status: 1 });
companySchema.index({ "contact.email": 1 });
companySchema.index({ "members.userId": 1 });
companySchema.index({ "subscription.plan": 1 });
companySchema.index({ isVerified: 1 });
companySchema.index({ createdAt: -1 });
companySchema.index({ lastActivity: -1 });

companySchema.virtual("companyAge").get(function () {
  if (!this.foundedYear) return null;
  return new Date().getFullYear() - this.foundedYear;
});

// companySchema.virtual("fullAddress").get(function () {
//   const addr = this.address;
//   return `${addr.street}, ${addr.ward}, ${addr.district}, ${addr.city}, ${addr.country}`;
// });
companySchema.virtual("fullAddress").get(function () {
  const addr = this.address;
  return `${addr.street}, ${addr.ward}, ${addr.district}, ${addr.city}`;
});

companySchema.virtual("memberCount").get(function () {
  return this.members.filter((member) => member.status === "active").length;
});

companySchema.virtual("isSubscriptionActive").get(function () {
  if (this.subscription.plan === "free") return true;
  return this.subscription.endDate && this.subscription.endDate > new Date();
});

companySchema.pre("save", async function (next) {
  if (this.isModified("name") && !this.slug) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  if (this.isModified("isVerified") && this.isVerified && !this.verificationDate) {
    this.verificationDate = new Date();
  }

  this.lastActivity = new Date();

  this.members.forEach((member) => {
    if (member.role === "admin_company" && member.permissions.length === 0) {
      member.permissions = [
        "create_jobs",
        "edit_jobs",
        "delete_jobs",
        "view_applications",
        "manage_applications",
        "manage_company",
        "manage_members",
        "view_analytics",
      ];
    }
  });

  next();
});

companySchema.statics.findByIndustry = function (industry) {
  return this.find({ industry, status: "active" });
};

companySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug, status: "active" });
};

companySchema.statics.searchCompanies = function (query, filters = {}) {
  const searchCriteria = {
    $text: { $search: query },
    status: "active",
    ...filters,
  };

  return this.find(searchCriteria).sort({ score: { $meta: "textScore" } });
};

companySchema.statics.findVerifiedCompanies = function () {
  return this.find({
    status: "active",
    isVerified: true,
  }).sort({ verificationDate: -1 });
};

companySchema.methods.activate = function () {
  this.status = "active";
  return this.save();
};

companySchema.methods.deactivate = function () {
  this.status = "inactive";
  return this.save();
};

companySchema.methods.verify = function () {
  this.isVerified = true;
  this.verificationDate = new Date();
  this.status = "active";
  return this.save();
};

companySchema.methods.addMember = function (userId, userEmail, userName, role = "recruiter", invitedBy) {
  console.log("addMember userEmail:", userEmail);
  const member = {
    userId,
    userEmail,
    userName,
    role,
    invitedBy,
    status: "pending",
  };
  this.members.push(member);
  return this.save();
};

companySchema.methods.removeMember = function (userId) {
  this.members = this.members.filter((member) => !member.userId.equals(userId));
  return this.save();
};

companySchema.methods.updateMemberRole = function (userId, newRole) {
  const member = this.members.find((m) => m.userId.equals(userId));
  if (member) {
    member.role = newRole;
    return this.save();
  }
  throw new Error("Member not found");
};

companySchema.methods.acceptMember = function (userId, userName) {
  const member = this.members.find((m) => m.userId.equals(userId));
  if (member) {
    member.status = "active";
    if (userName) member.userName = userName;
    // Nếu permissions rỗng thì gán mặc định
    if (!member.permissions || member.permissions.length === 0) {
      if (member.role === "recruiter") {
        member.permissions = ["create_jobs", "edit_jobs", "delete_jobs", "view_applications", "manage_applications"];
      }
      // Có thể thêm các role khác nếu muốn
    }
    return this.save();
  }
  throw new Error("Member not found");
};

companySchema.methods.canUserManage = function (userId) {
  const member = this.members.find((m) => m.userId.equals(userId) && m.status === "active");

  return member && (member.role === "admin_company" || member.permissions.includes("manage_company"));
};

companySchema.methods.canUserPost = function (userId) {
  const member = this.members.find((m) => m.userId.equals(userId) && m.status === "active");

  return member && (member.role === "admin_company" || member.permissions.includes("create_jobs"));
};

companySchema.methods.updateStats = function (statsUpdate) {
  Object.assign(this.stats, statsUpdate);
  return this.save();
};

companySchema.methods.incrementProfileViews = function () {
  this.stats.profileViews += 1;
  return this.save();
};

const Company = mongoose.model("Company", companySchema);

export default Company;
