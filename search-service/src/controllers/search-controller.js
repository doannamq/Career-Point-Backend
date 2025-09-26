// import Search from "../models/Search.js";

// const searchJobController = async (req, res, next) => {
//   try {
//     const {
//       query, // Từ khóa tìm kiếm
//       location, // Lọc theo location
//       jobType, // Lọc theo loại công việc
//       minSalary, // Lọc theo mức lương tối thiểu
//       maxSalary, // Lọc theo mức lương tối đa
//       experience, // Lọc theo kinh nghiệm
//       skills, // Lọc theo kỹ năng
//       sortBy = "score", // Sắp xếp theo (score, salary, createdAt)
//       sortOrder = "desc", // Thứ tự sắp xếp (asc, desc)
//       page = 1, // Trang hiện tại
//       limit = 10, // Số kết quả mỗi trang
//     } = req.query;

//     // Xây dựng query conditions
//     const conditions = {};

//     // Thay đổi tìm kiếm từ $text sang tìm kiếm theo title bằng regex
//     if (query) {
//       conditions.title = { $regex: query, $options: "i" };
//     }

//     // Thêm các điều kiện lọc
//     if (location) {
//       conditions.location = { $regex: location, $options: "i" };
//     }

//     if (jobType) {
//       conditions.jobType = jobType;
//     }

//     if (minSalary || maxSalary) {
//       conditions.salary = {};
//       if (minSalary) conditions.salary.$gte = Number(minSalary);
//       if (maxSalary) conditions.salary.$lte = Number(maxSalary);
//     }

//     if (experience) {
//       conditions.experience = experience;
//     }

//     if (skills) {
//       const skillsArray = skills.split(",").map((skill) => skill.trim());
//       conditions.skills = { $in: skillsArray };
//     }

//     // Xây dựng options cho sort
//     const sortOptions = {};
//     sortOptions.isFeatured = -1; // Ưu tiên các công việc nổi bật

//     if (sortBy === "salary") {
//       sortOptions.salary = sortOrder === "asc" ? 1 : -1;
//     } else if (sortBy === "createdAt") {
//       sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
//     } else {
//       // Mặc định sort theo createdAt nếu không phải salary
//       sortOptions.createdAt = -1;
//     }

//     // Tính toán skip cho phân trang
//     const skip = (page - 1) * limit;

//     // Thực hiện tìm kiếm
//     const results = await Search.find(conditions).sort(sortOptions).skip(skip).limit(Number(limit));

//     // Đếm tổng số kết quả
//     const total = await Search.countDocuments(conditions);

//     // Kiểm tra nếu không có kết quả
//     if (total === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Không tìm thấy kết quả phù hợp với tiêu chí tìm kiếm",
//         data: {
//           results: [],
//           pagination: {
//             total: 0,
//             page: Number(page),
//             limit: Number(limit),
//             totalPages: 0,
//           },
//         },
//       });
//     }

//     // Trả về kết quả tìm kiếm thành công
//     res.status(200).json({
//       success: true,
//       message: "Tìm kiếm thành công",
//       data: {
//         results,
//         pagination: {
//           total,
//           page: Number(page),
//           limit: Number(limit),
//           totalPages: Math.ceil(total / limit),
//         },
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// export { searchJobController };

// ============================================================
import Search from "../models/Search.js";

// Hàm xen kẽ các job theo tỷ lệ
function interleaveJobs(featuredJobs, hotJobs, normalJobs, limit) {
  const result = [];

  // Định nghĩa pattern xen kẽ: Featured -> Hot -> Normal -> Normal -> Normal
  // Tỷ lệ khoảng Featured:Hot:Normal = 1:2:7 (có thể điều chỉnh)
  const pattern = ["featured", "hot", "normal", "normal", "normal"];

  let indices = {
    featured: 0,
    hot: 0,
    normal: 0,
  };

  let patternIndex = 0;

  // Xen kẽ cho đến khi đủ limit hoặc hết job
  while (
    result.length < limit &&
    (indices.featured < featuredJobs.length || indices.hot < hotJobs.length || indices.normal < normalJobs.length)
  ) {
    const currentType = pattern[patternIndex % pattern.length];

    if (currentType === "featured" && indices.featured < featuredJobs.length) {
      result.push(featuredJobs[indices.featured++]);
    } else if (currentType === "hot" && indices.hot < hotJobs.length) {
      result.push(hotJobs[indices.hot++]);
    } else if (currentType === "normal" && indices.normal < normalJobs.length) {
      result.push(normalJobs[indices.normal++]);
    }

    patternIndex++;
  }

  return result;
}

// Hàm lấy job theo từng loại với pagination
async function getJobsByType(conditions, sortOptions, jobType) {
  const typeConditions = { ...conditions };

  if (jobType === "featured") {
    typeConditions.isFeatured = true;
  } else if (jobType === "hot") {
    typeConditions.isHot = true;
    typeConditions.isFeatured = { $ne: true };
  } else {
    typeConditions.isFeatured = { $ne: true };
    typeConditions.isHot = { $ne: true };
  }

  return await Search.find(typeConditions).sort(sortOptions).lean();
}

const searchJobController = async (req, res, next) => {
  try {
    const {
      query,
      location,
      jobType,
      minSalary,
      maxSalary,
      experience,
      skills,
      sortBy = "score",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      enableInterleaving = true, // Thêm option để bật/tắt interleaving
    } = req.query;

    // Xây dựng query conditions (giữ nguyên logic cũ)
    const conditions = {};

    if (query) {
      conditions.title = { $regex: query, $options: "i" };
    }

    if (location) {
      conditions.location = { $regex: location, $options: "i" };
    }

    if (jobType) {
      conditions.jobType = jobType;
    }

    if (minSalary || maxSalary) {
      conditions.salary = {};
      if (minSalary) conditions.salary.$gte = Number(minSalary);
      if (maxSalary) conditions.salary.$lte = Number(maxSalary);
    }

    if (experience) {
      conditions.experience = experience;
    }

    if (skills) {
      const skillsArray = skills.split(",").map((skill) => skill.trim());
      conditions.skills = { $in: skillsArray };
    }

    // Xây dựng sort options (bỏ isFeatured vì sẽ handle riêng)
    const sortOptions = {};

    if (sortBy === "salary") {
      sortOptions.salary = sortOrder === "asc" ? 1 : -1;
      sortOptions.createdAt = -1; // Secondary sort
    } else if (sortBy === "createdAt") {
      sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    let results;
    let total;

    if (enableInterleaving === "true" || enableInterleaving === true) {
      // Lấy tất cả job từng loại
      const [featuredJobs, hotJobs, normalJobs] = await Promise.all([
        getJobsByType(conditions, sortOptions, "featured"),
        getJobsByType(conditions, sortOptions, "hot"),
        getJobsByType(conditions, sortOptions, "normal"),
      ]);

      // Xen kẽ toàn bộ
      const allInterleaved = interleaveJobs(
        featuredJobs,
        hotJobs,
        normalJobs,
        featuredJobs.length + hotJobs.length + normalJobs.length
      );

      // Phân trang sau khi xen kẽ
      total = allInterleaved.length;
      const start = (Number(page) - 1) * Number(limit);
      results = allInterleaved.slice(start, start + Number(limit));
    } else {
      // Strategy 2: Traditional approach với ưu tiên featured
      const skip = (page - 1) * limit;

      const sortOptionsWithPriority = {
        isFeatured: -1,
        isHot: -1,
        ...sortOptions,
      };

      results = await Search.find(conditions).sort(sortOptionsWithPriority).skip(skip).limit(Number(limit)).lean();

      total = await Search.countDocuments(conditions);
    }

    // Kiểm tra nếu không có kết quả
    if (total === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kết quả phù hợp với tiêu chí tìm kiếm",
        data: {
          results: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
          },
        },
      });
    }

    // Thêm thông tin loại job vào response để debug
    const resultsWithType = results.map((job) => ({
      ...job,
      jobCategory: job.isFeatured ? "featured" : job.isHot ? "hot" : "normal",
    }));

    // Trả về kết quả
    res.status(200).json({
      success: true,
      message: "Tìm kiếm thành công",
      data: {
        results: resultsWithType,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
        // Thêm thống kê để debug
        stats: {
          featured: results.filter((j) => j.isFeatured).length,
          hot: results.filter((j) => j.isHot && !j.isFeatured).length,
          normal: results.filter((j) => !j.isFeatured && !j.isHot).length,
          interleavingEnabled: enableInterleaving === "true" || enableInterleaving === true,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { searchJobController };
