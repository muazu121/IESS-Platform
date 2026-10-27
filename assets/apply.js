import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjAtSFOpuMvbd9CyZQ_5MB8d1GTYqMkn4",
  authDomain: "iess-platform.firebaseapp.com",
  projectId: "iess-platform",
  storageBucket: "iess-platform.firebasestorage.app",
  messagingSenderId: "278227611224",
  appId: "1:278227611224:web:f8a5e87f7a80328a82642d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const form = document.getElementById("training-application");
const message = document.getElementById("applicationMessage");
const successPanel = document.getElementById("applicationSuccess");
const applicationNumber = document.getElementById("applicationNumber");
const submitButton = document.getElementById("submitApplication");
const draftStatus = document.getElementById("draftStatus");
const socialProofInput = document.getElementById("socialProof");
const socialProofPreview = document.getElementById("socialProofPreview");
const storageKey = "iess_training_application_draft";

function applicationId() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6).toUpperCase();
  return `IESS-APP-${stamp}-${random}`;
}

function setMessage(text) {
  message.textContent = text;
  message.classList.toggle("is-visible", Boolean(text));
}

async function compressedSocialProof(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Upload a PNG, JPEG or WebP screenshot.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("The screenshot must be smaller than 8 MB.");
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("The selected screenshot could not be read."));
      img.src = imageUrl;
    });
    const scale = Math.min(1, 1100 / image.width, 1500 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let dataUrl = "";
    for (const quality of [0.72, 0.6, 0.48, 0.36]) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 700000) break;
    }
    if (dataUrl.length > 850000) {
      throw new Error("The screenshot is still too large after compression. Crop it around the follow status and try again.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

socialProofInput?.addEventListener("change", () => {
  const file = socialProofInput.files?.[0];
  if (!socialProofPreview) return;
  const img = socialProofPreview.querySelector("img");
  if (!file) {
    socialProofPreview.hidden = true;
    return;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    socialProofPreview.hidden = true;
    setMessage("Choose a PNG, JPEG or WebP screenshot smaller than 8 MB.");
    return;
  }
  setMessage("");
  if (img) img.src = URL.createObjectURL(file);
  socialProofPreview.hidden = false;
});

function formData() {
  const values = Object.fromEntries(new FormData(form).entries());
  for (const key of Object.keys(values)) {
    if (typeof values[key] === "string") values[key] = values[key].trim();
  }
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) {
    values[checkbox.name] = checkbox.checked;
  }
  return values;
}

function saveDraft() {
  if (!draftStatus) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(formData()));
    draftStatus.textContent = "Draft saved on this device";
  } catch {
    draftStatus.textContent = "Draft could not be saved";
  }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!draft) return;
    for (const [key, value] of Object.entries(draft)) {
      const control = form.elements.namedItem(key);
      if (!control) continue;
      if (control.type === "checkbox") control.checked = value === "on" || value === true;
      else control.value = value;
    }
    if (draftStatus) draftStatus.textContent = "Saved draft restored";
  } catch {
    localStorage.removeItem(storageKey);
  }
}

restoreDraft();
let draftTimer;
form.addEventListener("input", () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 500);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  if (!form.checkValidity()) {
    form.reportValidity();
    const firstInvalid = form.querySelector(":invalid");
    firstInvalid?.focus();
    setMessage("Please complete all required fields before submitting.");
    return;
  }

  const id = applicationId();
  const values = formData();
  const socialProofFile = socialProofInput?.files?.[0];
  let socialProofImage = "";
  try {
    socialProofImage = await compressedSocialProof(socialProofFile);
  } catch (error) {
    setMessage(error.message);
    socialProofInput?.focus();
    return;
  }
  const payload = {
    ...values,
    applicationId: id,
    firstName: values.firstName,
    lastName: values.lastName,
    name: [values.firstName, values.middleName, values.lastName].filter(Boolean).join(" "),
    email: values.email.toLowerCase(),
    status: "Pending",
    socialVerificationStatus: "Pending",
    source: "Public training application",
    submittedDate: new Date().toISOString(),
    consentPrivacy: Boolean(values.consentPrivacy),
    consentTerms: Boolean(values.consentTerms),
    receiveUpdates: Boolean(values.receiveUpdates),
    socialProofImage,
    socialProofFileName: socialProofFile.name,
    socialProofMimeType: socialProofFile.type,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";

  try {
    await setDoc(doc(db, "iess_data", `iess_application_${id}`), {
      type: "enrollment_application",
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    localStorage.removeItem(storageKey);
    form.hidden = true;
    successPanel.hidden = false;
    applicationNumber.textContent = id;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Application submission failed:", error);
    setMessage(
      "Your application could not be submitted. Check your internet connection and try again. If the problem continues, email integratedpower.iess@gmail.com."
    );
    submitButton.disabled = false;
    submitButton.textContent = "Submit application →";
  }
});

document.getElementById("copyApplicationNumber")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(applicationNumber.textContent || "");
    document.getElementById("copyApplicationNumber").textContent = "Application number copied";
  } catch {
    document.getElementById("copyApplicationNumber").textContent = "Select and copy the number above";
  }
});
