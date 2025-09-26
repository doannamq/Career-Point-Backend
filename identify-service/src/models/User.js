import mongoose from "mongoose";
import argon2 from "argon2";

// Tạo schema cho experience
const experienceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: false,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: false,
  },
});

// Tạo schema cho education
const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: true,
  },
  institution: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: false,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: false,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
    },
    location: {
      type: String,
      required: false,
    },
    bio: {
      type: String,
      required: false,
    },
    profilePicture: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["applicant", "recruiter", "admin"],
      default: "applicant",
    },
    skills: {
      type: [String],
      default: [], // Thêm default: [] để khởi tạo mảng rỗng
      required: false,
    },
    experience: {
      type: [experienceSchema], // Sử dụng schema chi tiết thay vì [Object]
      default: [],
      required: false,
    },
    education: {
      type: [educationSchema], // Sử dụng schema chi tiết thay vì [Object]
      default: [],
      required: false,
    },
    // company: {
    //   type: String,
    //   required: false,
    // },
    // companyWebsite: {
    //   type: String,
    //   required: false,
    // },
    // companyDescription: {
    //   type: String,
    //   required: false,
    // },
    companies: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Company",
      default: [],
    },
    industry: {
      type: String,
      required: false,
    },
    resumeUrl: {
      type: String,
      required: false,
    },
    resumeFileName: {
      type: String,
      required: false,
    },
    resetPasswordOTP: {
      type: String,
      required: false,
    },
    resetPasswordExpire : {
      type: Date,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    try {
      this.password = await argon2.hash(this.password);
    } catch (error) {
      return next(error);
    }
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch (error) {
    throw error;
  }
};

userSchema.index({ username: "text" });

const User = mongoose.model("User", userSchema);

export default User;
