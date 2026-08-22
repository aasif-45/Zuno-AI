import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";
import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

export const login = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({
      firebaseUID: decoded.uid,
    });

    if (!user) {
      let displayName = decoded.name || "";
      let email = decoded.email || "";
      let photoURL = decoded.picture || "";

      try {
        const firebaseUser = await getAuth(app).getUser(decoded.uid);
        displayName = firebaseUser.displayName || displayName;
        email = firebaseUser.email || email;
        photoURL = firebaseUser.photoURL || photoURL;
      } catch (adminErr) {
        console.warn("getUser Admin API warning, using decoded token claims:", adminErr.message);
      }

      user = await User.create({
        firebaseUID: decoded.uid,
        name: displayName,
        email: email,
        avatar: photoURL,
        plan: "free",
        credits: 100,
        totalCredits: 100,
      });
    }

    const sessionId = crypto.randomUUID();
    const sessionPayload = {
      userId: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan || "free",
      credits: user.credits ?? 100,
      totalCredits: user.totalCredits ?? 100,
      planStartedAt: user.planStartedAt,
      planExpiresAt: user.planExpiresAt,
    };

    try {
      await redis.set(`session-${sessionId}`, JSON.stringify(sessionPayload), "EX", 7 * 24 * 60 * 60);
      await redis.set(`user_session:${user._id.toString()}`, sessionId, "EX", 7 * 24 * 60 * 60);
    } catch (redisErr) {
      console.warn("Redis session store warning:", redisErr.message);
    }

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(sessionPayload);

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: `Login Error: ${error.message}`,
    });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;
    if (sessionId) {
      try {
        const rawSession = await redis.get(`session-${sessionId}`);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.userId) {
            await redis.del(`user_session:${parsed.userId}`);
          }
        }
        await redis.del(`session-${sessionId}`);
      } catch (err) {
        console.warn("Redis logout cleanup error:", err.message);
      }
    }
    res.clearCookie("session");
    return res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    return res.status(500).json({ message: `Logout Error: ${error.message}` });
  }
};

export const updateUserPayment = async (req, res) => {
  try {
    const { userId, plan, credits } = req.body;

    console.log("--> Received updateUserPayment request:", { userId, plan, credits });

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    if (!plan || credits == null) {
      return res.status(400).json({
        message: "Plan and credits are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      console.error("updateUserPayment: User not found for ID:", userId);
      return res.status(404).json({
        message: `User not found for ID: ${userId}`,
      });
    }

    // Update plan
    user.plan = plan;

    // Set credits based on plan purchase
    user.credits = Number(credits);
    user.totalCredits = Number(credits);

    // Plan starts now
    user.planStartedAt = new Date();

    // Plan expires after 30 days
    user.planExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    await user.save();
    console.log("--> User saved in MongoDB with updated plan:", user.plan, "credits:", user.credits);

    // Update ALL active Redis sessions for this user
    try {
      const targetUserIdStr = user._id.toString();
      const sessionKeys = await redis.keys("session-*");

      for (const sKey of sessionKeys) {
        const rawSession = await redis.get(sKey);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed.userId === targetUserIdStr || parsed._id === targetUserIdStr) {
            const updatedPayload = {
              ...parsed,
              userId: targetUserIdStr,
              _id: targetUserIdStr,
              plan: user.plan,
              credits: user.credits,
              totalCredits: user.totalCredits,
              planStartedAt: user.planStartedAt,
              planExpiresAt: user.planExpiresAt,
            };
            await redis.set(sKey, JSON.stringify(updatedPayload), "EX", 7 * 24 * 60 * 60);
            console.log("--> Updated Redis session key:", sKey, "with new plan:", user.plan);
          }
        }
      }
    } catch (redisErr) {
      console.warn("Redis payment session update warning:", redisErr.message);
    }

    const responseUser = {
      userId: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
      credits: user.credits,
      totalCredits: user.totalCredits,
      planStartedAt: user.planStartedAt,
      planExpiresAt: user.planExpiresAt,
    };

    return res.status(200).json({
      success: true,
      message: "Plan and credits updated successfully",
      user: responseUser,
    });
  } catch (error) {
    console.error("Update user payment error:", error);

    return res.status(500).json({
      message: `Update user payment error: ${error.message}`,
    });
  }
};

export const deductCredits = async (req, res) => {
  try {
    const { userId, agent, amount } = req.body;

    const COST = {
      chat: 2,
      search: 3,
      coding: 3,
      pdf: 5,
      ppt: 5,
      image: 4,
    };

    const agentKey = (agent || "chat").toString().toLowerCase();
    const requiredCredits = amount !== undefined && amount !== null ? Number(amount) : (COST[agentKey] || COST.chat);

    if (isNaN(requiredCredits) || requiredCredits < 0) {
      return res.status(400).json({
        message: "Invalid credit amount",
      });
    }

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if user has zero or insufficient credits
    if ((user.credits || 0) <= 0 || (requiredCredits > 0 && (user.credits || 0) < requiredCredits)) {
      return res.status(400).json({
        message: "Not enough credits",
        requiredCredits,
        credits: user.credits || 0,
      });
    }

    // Only mutate database credits if requiredCredits > 0
    if (requiredCredits > 0) {
      user.credits = Math.max((user.credits || 0) - requiredCredits, 0);
      await user.save();

      // Update ALL active Redis sessions for this user ID
      try {
        const targetUserIdStr = user._id.toString();
        const sessionKeys = await redis.keys("session-*");

        for (const sKey of sessionKeys) {
          const rawSession = await redis.get(sKey);
          if (rawSession) {
            const parsed = JSON.parse(rawSession);
            if (parsed.userId === targetUserIdStr || parsed._id === targetUserIdStr) {
              const updatedPayload = {
                ...parsed,
                userId: targetUserIdStr,
                _id: targetUserIdStr,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planStartedAt: user.planStartedAt,
                planExpiresAt: user.planExpiresAt,
              };
              await redis.set(sKey, JSON.stringify(updatedPayload), "EX", 7 * 24 * 60 * 60);
            }
          }
        }
      } catch (redisErr) {
        console.warn("Redis deduct credits session update error:", redisErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      agent: agentKey,
      deducted: requiredCredits,
      credits: user.credits,
    });

  } catch (error) {
    console.error("Deduct credits error:", error);
    return res.status(500).json({
      message: `Deduct credits error: ${error.message}`,
    });
  }
};