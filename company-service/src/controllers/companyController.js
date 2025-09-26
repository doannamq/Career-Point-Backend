import Company from "../models/Company.js";
import logger from "../utils/logger.js";
import { publishEvent } from "../utils/rabbitmq.js";
import validateCreateCompany from "../utils/validation.js";
import { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } from "vnpay";
import crypto from "crypto";
import qs from "qs";

//create new company
const createCompany = async (req, res) => {
  try {
    const userRole = req.user.userRole;
    if (userRole !== "recruiter") {
      return res.status(403).json({ success: false, message: "You can't create company now!" });
    }

    const { error } = validateCreateCompany(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const companyData = {
      ...req.body,
      subscription: {
        plan: "free",
        startDate: Date.now(),
        endDate: null,
        jobPostLimit: 3,
        featuredJobsLimit: 0,
      },
      members: [
        {
          userId: req.user.userId,
          userName: req.user.userName,
          userEmail: req.user.userEmail,
          role: "admin_company",
          status: "active",
          permissions: [
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
    };

    const newCompany = new Company(companyData);
    await newCompany.save();

    // console.log(">>> company.created payload:", {
    //   companyId: newCompany._id.toString(),
    //   userId: req.user.userId,
    //   subscription: newCompany.subscription,
    // });

    await publishEvent("company.created", {
      companyId: newCompany._id.toString(),
      userId: req.user.userId,
      subscription: newCompany.subscription,
    });

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      newCompany,
    });
  } catch (error) {
    console.error("Error creating company", error);
    logger.error("Error creating company", error);
    res.status(500).json({ success: false, message: "Error creating company" });
  }
};

//verify company
const verifyCompany = async (req, res) => {
  logger.info("Verify company endpoint hit ...");
  try {
    const userRole = req.user.userRole;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can't verify company now!",
      });
    }

    const { id: companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (company.status === "active") {
      return res.status(200).json({
        success: true,
        message: "Company already actived",
      });
    }

    const updatedCompany = await Company.findByIdAndUpdate(companyId, { isVerified: true, status: "active" });

    const owner = company.members.find((m) => m.role === "admin_company");
    const ownerId = owner ? owner.userId : null;

    await publishEvent("company.verified", {
      companyId: updatedCompany._id.toString(),
      name: updatedCompany.name,
      userId: ownerId, // <-- userId của admin công ty để gửi thông báo
      message: `Công ty ${updatedCompany.name} của bạn đã được xác thực. Hãy bắt đầu đăng tuyển ngay!`,
      type: "company_verified",
    });

    res.json({
      success: true,
      message: "Your company is verified",
      company: updatedCompany,
    });
  } catch (error) {
    logger.error("Error verifying company", error);
    res.status(500).json({
      success: false,
      message: "Error verifying company",
    });
  }
};

//reject company
const rejectCompany = async (req, res) => {
  logger.info("Reject company endpoint hit ...");
  try {
    const userRole = req.user.userRole;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can't reject company now!",
      });
    }

    const { id: companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (company.status === "inactive") {
      return res.status(200).json({
        success: true,
        message: "Company already reject",
      });
    }

    const updatedCompany = await Company.findByIdAndUpdate(companyId, { isVerified: true, status: "inactive" });

    res.json({
      success: true,
      message: "Your company is rejected",
    });
  } catch (error) {
    logger.error("Error rejecting company", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting company",
    });
  }
};

//get all company for admin
const getAllCompany = async (req, res) => {
  logger.info("Get all company endpoint hit ...");
  try {
    const { query, company, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const searchRegex = typeof query === "string" && query.trim() !== "" ? { $regex: query, $options: "i" } : undefined;

    const searchFilter = searchRegex
      ? {
          $or: [{ name: searchRegex }, { company: searchRegex }],
        }
      : {};

    const result = await Company.find(searchFilter).skip(skip).limit(Number(limit));

    const totalCompanies = await Company.countDocuments(searchFilter);

    const totalPages = Math.ceil(totalCompanies / limit);

    res.status(200).json({
      success: true,
      message: "Company fetched successfully",
      companies: result,
      totalCompanies,
      totalPages,
      currentPage: Number(page),
    });
  } catch (error) {
    logger.error("Error get all company");
    res.status(500).json({
      success: false,
      message: "Error get all company",
    });
  }
};

//search company
const searchCompany = async (req, res) => {
  logger.info("Search company endpoint hit ...");
  try {
    const {
      query, // Từ khóa tìm kiếm
      industry, // Lọc theo ngành nghề
      isVerified, // Lọc theo trạng thái xác thực
      page = 1, // Trang hiện tại
      limit = 10, // Số kết quả mỗi trang
    } = req.query;

    // Xây dựng điều kiện tìm kiếm
    const conditions = { status: "active" };

    if (query && query.trim() !== "") {
      conditions.name = { $regex: query, $options: "i" };
    }

    if (industry) {
      conditions.industry = industry;
    }

    if (isVerified !== undefined) {
      conditions.isVerified = isVerified === "true";
    }

    // Tính toán skip cho phân trang
    const skip = (page - 1) * limit;

    // Thực hiện tìm kiếm
    const companies = await Company.find(conditions).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    // Đếm tổng số kết quả
    const total = await Company.countDocuments(conditions);

    // Kiểm tra nếu không có kết quả
    if (total === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công ty phù hợp với tiêu chí tìm kiếm",
        data: {
          companies: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
          },
        },
      });
    }

    // Trả về kết quả tìm kiếm thành công
    res.status(200).json({
      success: true,
      message: "Tìm kiếm công ty thành công",
      data: {
        companies,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Error searching company", error);
    res.status(500).json({
      success: false,
      message: "Error searching company",
    });
  }
};

//get company by id
const getCompanyById = async (req, res) => {
  logger.info("get company by id endpoint hit ...");
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company found",
      company,
    });
  } catch (error) {
    logger.error("Error get company by id");
    res.status(500).json({
      success: false,
      message: "Error get company by id",
    });
  }
};

//get company status
const getCompanyStatus = async (req, res) => {
  logger.info("get company status endpoint hit ...");
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId, { status: 1, _id: 0 });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Get company status successfully",
      status: company.status,
    });
  } catch (error) {
    logger.error("Error get company status", error);
    res.status(500).json({
      success: false,
      message: "Error get company status",
    });
  }
};

//get company data for posting job
const getCompanyForPostingJob = async (req, res) => {
  logger.info("Get company data for posting job endpoint hit ...");
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId, { name: 1, address: 1, _id: 1 });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Get company data for posting job successfully",
      companyId: company._id,
      companyName: company.name,
      companyAddress: company.address,
    });
  } catch (error) {
    logger.error("Error get company data for posting job", error);
    res.status(500).json({
      success: false,
      message: "Error get company data for posting job",
    });
  }
};

// User request to join a company
const requestJoinCompany = async (req, res) => {
  logger.info("Request to join company endpoint hit ...");
  try {
    const userId = req.user.userId;
    const { id: companyId } = req.params;
    const { userEmail } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    // Check if user is already a member (any status)
    const existing = company.members.find((m) => m.userId.equals(userId));
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "You have already requested to join or are a member of this company" });
    }
    await company.addMember(userId, userEmail, req.user.userName, "recruiter");
    return res.status(200).json({ success: true, message: "Join request sent, please wait for approval" });
  } catch (error) {
    logger.error("Error to request to join company", error);
    return res.status(500).json({ success: false, message: "Error requesting to join company" });
  }
};

// Admin accept member join request
const acceptJoinRequest = async (req, res) => {
  logger.info("Accept to join company endpoint hit ...");
  try {
    const adminId = req.user.userId;
    const { id: companyId, memberId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // Only admin or manager can accept
    const adminMember = company.members.find(
      (m) =>
        m.userId.equals(adminId) &&
        m.status === "active" &&
        (m.role === "admin" || m.permissions.includes("manage_members"))
    );
    if (!adminMember) {
      return res.status(403).json({ success: false, message: "You do not have permission to accept members" });
    }

    // Tìm member cần phê duyệt
    const memberToAccept = company.members.find((m) => m.userId.equals(memberId));
    if (!memberToAccept) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // Sử dụng userName của member cần phê duyệt
    await company.acceptMember(memberId, memberToAccept.userName);

    // Lấy lại member vừa được accept
    const updatedMember = company.members.find((m) => m.userId.equals(memberId));

    // Publish event company id to identify service
    await publishEvent("companies.member.accepted", {
      userId: memberId,
      companyId: companyId,
      companyName: company.name,
    });
    return res.status(200).json({
      success: true,
      message: "Member accepted",
      member: updatedMember,
    });
  } catch (error) {
    logger.error("Error to accept to join company", error);
    return res.status(500).json({ success: false, message: "Error accepting member" });
  }
};

// Admin reject member join request
const rejectJoinRequest = async (req, res) => {
  logger.info("Reject to join company endpoint hit ...");
  try {
    const adminId = req.user.userId;
    const { id: companyId, memberId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    // Only admin or manager can reject
    const adminMember = company.members.find(
      (m) =>
        m.userId.equals(adminId) &&
        m.status === "active" &&
        (m.role === "admin" || m.permissions.includes("manage_members"))
    );
    if (!adminMember) {
      return res.status(403).json({ success: false, message: "You do not have permission to reject members" });
    }
    await company.removeMember(memberId);
    return res.status(200).json({ success: true, message: "Member rejected and removed" });
  } catch (error) {
    logger.error("Error to reject to join company", error);
    return res.status(500).json({ success: false, message: "Error rejecting member" });
  }
};

// Admin invite user to join company
const inviteUserToJoinCompany = async (req, res) => {
  logger.info("Invite user to join company endpoint hit ...");
  try {
    const adminId = req.user.userId;
    const { id: companyId } = req.params;
    const { userEmail, role = "recruiter" } = req.body;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const adminMember = company.members.find(
      (m) =>
        m.userId.equals(adminId) &&
        m.status === "active" &&
        (m.role === "admin_company" || m.permissions.includes("manage_members"))
    );
    if (!adminMember) {
      return res.status(403).json({ success: false, message: "You do not have permission to invite members" });
    }

    const existingMember = company.members.find((m) => m.userEmail === userEmail);
    if (existingMember) {
      return res.status(400).json({ success: false, message: "You have already invited this user" });
    }

    await company.addMember(undefined, userEmail, undefined, role, adminId);

    await publishEvent("companies.member.invited", {
      companyId: companyId,
      companyName: company.name,
      userEmail, // Email của user được mời
      invitedBy: adminId,

      message: `Bạn đã được mời tham gia công ty ${company.name}.`,
    });
    return res.status(200).json({ success: true, message: "User invited successfully" });
  } catch (error) {
    logger.error("Error inviting user to join company", error);
    return res.status(500).json({ success: false, message: "Error inviting user" });
  }
};

// User accept join company
const acceptJoinCompany = async (req, res) => {
  logger.info("Accept invite to join company endpoint hit ...");
  try {
    const userId = req.user.userId;
    const userName = req.user.userName;
    const userEmail = req.user.userEmail;
    const userRole = req.user.userRole;
    const { id: companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const member = company.members.find((m) => m.userEmail === userEmail && m.status === "pending");
    if (!member) {
      return res.status(404).json({ success: false, message: "Invite not found or already accepted" });
    }

    member.userId = userId;
    member.userName = userName;
    member.status = "active";
    member.role = userRole;

    await company.save();

    return res.status(200).json({ success: true, message: "Joined company successfully" });
  } catch (error) {
    logger.error("Error accepting invite to join company", error);
    return res.status(500).json({ success: false, message: "Error accepting invite" });
  }
};

// User reject join company
const rejectJoinCompany = async (req, res) => {
  logger.info("Reject invite to join company endpoint hit ...");
  try {
    const userEmail = req.user.userEmail;
    const { id: companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const member = company.members.find((m) => m.userEmail === userEmail && m.status === "pending");
    if (!member) {
      return res.status(404).json({ success: false, message: "Invite not found or already responded" });
    }

    // Xóa member theo email nếu userId chưa có
    company.members = company.members.filter((m) => !(m.userEmail === userEmail && m.status === "pending"));
    await company.save();

    return res.status(200).json({ success: true, message: "Invite rejected successfully" });
  } catch (error) {
    logger.error("Error rejecting invite to join company", error);
    return res.status(500).json({ success: false, message: "Error rejecting invite" });
  }
};

// User update subscription
const planPrices = {
  monthly: {
    free: 0,
    basic: 99000,
    premium: 999000,
    enterprise: 1999000,
  },
  annually: {
    free: 0,
    basic: 990000,
    premium: 9990000,
    enterprise: 19990000,
  },
};
const planDetails = {
  monthly: {
    free: { days: 0, jobPostLimit: 3, featuredJobsLimit: 0 },
    basic: { days: 30, jobPostLimit: 10, featuredJobsLimit: 1 },
    premium: { days: 30, jobPostLimit: 25, featuredJobsLimit: 3 },
    enterprise: { days: 30, jobPostLimit: 50, featuredJobsLimit: 5 },
  },
  annually: {
    free: { days: 0, jobPostLimit: 3, featuredJobsLimit: 0 },
    basic: { days: 365, jobPostLimit: 120, featuredJobsLimit: 12 },
    premium: { days: 365, jobPostLimit: 300, featuredJobsLimit: 36 },
    enterprise: { days: 365, jobPostLimit: 600, featuredJobsLimit: 60 },
  },
};

const updateSubscription = async (req, res) => {
  const { plan, companyId, billingCycle } = req.body;
  const userId = req.user.userId;

  if (!["monthly", "annually"].includes(billingCycle)) {
    return res.status(400).json({ success: false, message: "Invalid billing cycle" });
  }

  if (!planPrices[billingCycle][plan]) {
    return res.status(400).json({ success: false, message: "Invalid plan" });
  }

  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({
      success: false,
      message: "Company not found",
    });
  }

  const amount = planPrices[billingCycle][plan];
  const vnp_TxnRef = `${company._id}-${Date.now()}`;
  const now = new Date();
  const expire = new Date();
  expire.setDate(now.getDate() + 1);

  const vnpay = new VNPay({
    tmnCode: "GXHS67KQ",
    secureSecret: "RN5Q3LD2RTP1RVVAUKL4WO0UTY1I58LV",
    vnpayHost: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    testMode: true,
    hashAlgorithm: "SHA512",
    loggerFn: ignoreLogger,
  });

  const gatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:3000";
  const vnp_ReturnUrl = `${gatewayUrl}/v1/company/check-payment-vnpay`;

  const vnpayRespone = await vnpay.buildPaymentUrl({
    vnp_Amount: amount,
    vnp_IpAddr: "127.0.0.1",
    vnp_TxnRef: vnp_TxnRef,
    vnp_OrderInfo: JSON.stringify({ plan, billingCycle, userId }),
    vnp_OrderType: ProductCode.Other,
    vnp_ReturnUrl: vnp_ReturnUrl,
    vnp_Locale: VnpLocale.VN,
    vnp_CreateDate: dateFormat(now),
    vnp_ExpireDate: dateFormat(expire),
  });

  return res.status(201).json({
    success: true,
    vnpUrl: vnpayRespone,
  });
};

const checkPaymentVNPay = async (req, res) => {
  const { vnp_ResponseCode, vnp_TxnRef, vnp_OrderInfo } = req.query;
  const [companyId] = vnp_TxnRef.split("-");
  const { plan, billingCycle, userId } = JSON.parse(vnp_OrderInfo);

  const company = await Company.findById(companyId);
  if (!company) {
    return res.redirect(`${process.env.FRONTEND_URL}/plans?status=failed`);
  }

  if (vnp_ResponseCode === "00") {
    const { plan, billingCycle } = JSON.parse(vnp_OrderInfo);

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + planDetails[billingCycle][plan].days);

    company.subscription = {
      plan,
      billingCycle,
      startDate: now,
      endDate,
      jobPostLimit: planDetails[billingCycle][plan].jobPostLimit,
      featuredJobsLimit: planDetails[billingCycle][plan].featuredJobsLimit,
    };

    company.subscriptionHistory = company.subscriptionHistory || [];
    company.subscriptionHistory.push({
      plan,
      billingCycle,
      amount: planPrices[billingCycle][plan],
      startDate: now,
      endDate,
      purchasedAt: now,
      transactionId: vnp_TxnRef,
      status: "success",
    });

    await publishEvent("company.subscription.updated", {
      companyId: company._id.toString(),
      companyName: company.name,
      userId: userId,
      subscription: company.subscription,
      message: `Công ty ${company.name} đã nâng cấp lên gói ${plan} (${billingCycle})`,
      type: "success",
    });

    await company.save();

    // ✅ Redirect về FE với query success
    return res.redirect(`${process.env.FRONTEND_URL}/companies/plans?status=success&plan=${plan}`);
  } else {
    return res.redirect(`${process.env.FRONTEND_URL}/companies/plans?status=failed`);
  }
};

const getSubscriptionHistory = async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await Company.findById(companyId, { subscriptionHistory: 1, name: 1 });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({
      success: true,
      company: company.name,
      subscriptionHistory: company.subscriptionHistory || [],
    });
  } catch (error) {
    logger.error("Error get subscription history", error);
    res.status(500).json({
      success: false,
      message: "Error get subscription history",
    });
  }
};

export {
  createCompany,
  verifyCompany,
  rejectCompany,
  getAllCompany,
  searchCompany,
  getCompanyById,
  getCompanyStatus,
  getCompanyForPostingJob,
  requestJoinCompany,
  acceptJoinRequest,
  rejectJoinRequest,
  inviteUserToJoinCompany,
  acceptJoinCompany,
  rejectJoinCompany,
  updateSubscription,
  checkPaymentVNPay,
  getSubscriptionHistory,
};
