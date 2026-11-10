
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcrypt";
import { User, sequelize } from "../models/userModel.js";
import "../models/bookModel.js";
import "../models/loanModel.js";
await sequelize.sync();

export const loginPage = (req, res) => res.render("login", { title: "Login", authCard: "login" });
export const registerPage = (req, res) => res.render("login", { title: "Register", authCard: "register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });
export const dashboardPage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const user = await User.findByPk(req.session.userId, {
      attributes: ["id", "name", "email", "role"]
    });
    if (!user) {
      return req.session.destroy(() => res.redirect("/login"));
    }
    const account = user.get({ plain: true });
    const userInitials = account.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");

    if (account.role === "admin" || account.role === "staff") {
      return res.render("dashboard", {
        title: "Admin Dashboard",
        adminUser: account,
        adminInitials: userInitials
      });
    }

    res.render("userDashborad", {
      title: "User Dashboard",
      user: account,
      userInitials
    });
  } catch (error) {
    console.error("Could not load account:", error);
    res.status(500).send("Could not load your account. Please try again.");
  }
};

export const updateProfile = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const signedInUser = await User.findByPk(req.session.userId, { attributes: ["role"] });
  if (!signedInUser) return req.session.destroy(() => res.redirect("/login"));
  if (signedInUser.role === "admin" || signedInUser.role === "staff") {
    return res.status(403).send("Administrator profiles cannot be changed here.");
  }

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!name || !email) {
    return res.status(400).send("Name and email are required.");
  }

  try {
    const conflictingUser = await User.findOne({ where: { email } });
    if (conflictingUser && String(conflictingUser.id) !== String(req.session.userId)) {
      return res.status(409).send("That email address is already in use.");
    }

    await User.update({ name, email }, { where: { id: req.session.userId } });
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Could not update profile:", error);
    res.status(500).send("Could not update your profile. Please try again.");
  }
};

export const loginUser = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  try {
    const user = await User.findOne({ where: { email } });
    const match = user && await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).render("login", {
        title: "Login",
        authCard: "login",
        authError: "Email or password is incorrect.",
        email
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).render("login", {
          title: "Login",
          authCard: "login",
          authError: "Could not start your session. Please try again.",
          email
        });
      }

      req.session.userId = user.id;
      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).render("login", {
            title: "Login",
            authCard: "login",
            authError: "Could not start your session. Please try again.",
            email
          });
        }
        res.redirect("/dashboard");
      });
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).render("login", {
      title: "Login",
      authCard: "login",
      authError: "Login is temporarily unavailable. Please try again.",
      email
    });
  }
};

export const registerUser = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const showError = (message, status = 400) => res.status(status).render("login", {
    title: "Register",
    authCard: "register",
    registerError: message
  });

  if (!name || !email || password.length < 8) {
    return showError("Enter your name and email, and use a password with at least 8 characters.");
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return showError("An account with that email already exists.", 409);

    const hashed = await bcrypt.hash(password, 10);
    // Never accept a role from public registration; new accounts are regular patrons.
    const user = await User.create({ name, email, password: hashed, role: "visitors" });

    req.session.regenerate((error) => {
      if (error) return showError("Your account was created, but sign-in failed. Please log in.", 500);

      req.session.userId = user.id;
      req.session.save((saveError) => {
        if (saveError) return showError("Your account was created, but sign-in failed. Please log in.", 500);
        res.redirect("/dashboard");
      });
    });
  } catch (error) {
    console.error("Registration failed:", error);
    return showError("Registration is temporarily unavailable. Please try again.", 500);
  }
};

export const logoutUser = (req, res) => {
  if (!req.session) return res.redirect("/login");
  req.session.destroy(() => res.redirect("/login"));
};
