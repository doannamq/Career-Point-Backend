import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  createCompany,
  getAllCompany,
  getCompanyById,
  getCompanyForPostingJob,
  getCompanyStatus,
  rejectCompany,
  searchCompany,
  verifyCompany,
  requestJoinCompany,
  acceptJoinRequest,
  rejectJoinRequest,
  updateSubscription,
  checkPaymentVNPay,
  getSubscriptionHistory,
  inviteUserToJoinCompany,
  acceptJoinCompany,
  rejectJoinCompany,
} from "../controllers/companyController.js";

const router = express.Router();

router.get("/", getAllCompany);
router.get("/search", searchCompany);
router.get("/check-payment-vnpay", checkPaymentVNPay);
router.get("/:id", getCompanyById);

router.use(authenticateRequest);
router.post("/", createCompany);
router.get("/:id/status", getCompanyStatus);
router.get("/:id/for-posting", getCompanyForPostingJob);
router.get("/:id/subscription-history", getSubscriptionHistory);
router.post("/update-subscription", updateSubscription);
router.post("/:id/invite", inviteUserToJoinCompany);
router.patch("/:id/invite/accept", acceptJoinCompany);
router.delete("/:id/invite/reject", rejectJoinCompany);

//admin
router.patch("/:id/verify", verifyCompany);
router.patch("/:id/reject", rejectCompany);

router.post("/:id/join", requestJoinCompany);
router.patch("/:id/members/:memberId/accept", acceptJoinRequest);
router.patch("/:id/members/:memberId/reject", rejectJoinRequest);

export default router;
