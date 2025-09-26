import cloudinary from "../config/cloudinary.js";

export function uploadBufferToCloudinary(buffer, folder = "cv_uploads", mimetype = "application/pdf") {
  return new Promise((resolve, reject) => {
    // Xác định extension theo mimetype
    let extension = ".pdf";
    if (mimetype === "application/msword") extension = ".doc";
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") extension = ".docx";

    const opts = {
      folder: "cv_uploads",
      resource_type: "raw",
      public_id: `resume_${Date.now()}_${Math.round(Math.random() * 1e9)}.pdf`,
      type: "upload",
    };

    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);

      if (result && result.secure_url) {
        // secure_url có thể mở trực tiếp trên trình duyệt
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          original_filename: result.original_filename,
        });
      } else {
        reject(new Error("Upload failed, no URL returned"));
      }
    });

    // Gửi buffer vào Cloudinary
    stream.end(buffer);
  });
}
