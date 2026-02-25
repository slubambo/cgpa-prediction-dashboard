const GRADE_POINTS = { A: 9, B: 8, C: 7, D: 6, E: 5, O: 1, F: 0 };

const round = (value, digits) => Number(Number(value).toFixed(digits));

const expandCountsToGrades = (counts) => {
  const mapping = [
    ["D1", 1],
    ["D2", 2],
    ["C3", 3],
    ["C4", 4],
    ["C5", 5],
    ["C6", 6],
    ["P7", 7],
    ["P8", 8],
    ["F9", 9],
  ];
  const out = [];
  mapping.forEach(([key, grade]) => {
    const count = Number(counts[key] || 0);
    for (let i = 0; i < count; i += 1) out.push(grade);
  });
  return out;
};

const deriveOLevelFeatures = (numericCounts) => {
  const grades = expandCountsToGrades(numericCounts);
  const mean =
    grades.length > 0
      ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length
      : 0;
  const variance =
    grades.length > 0
      ? grades.reduce((sum, grade) => sum + (grade - mean) ** 2, 0) /
        grades.length
      : 0;

  return {
    olevel_subjects: grades.length,
    uce_distinctions: Number(numericCounts.D1 || 0) + Number(numericCounts.D2 || 0),
    uce_credits:
      Number(numericCounts.C3 || 0) +
      Number(numericCounts.C4 || 0) +
      Number(numericCounts.C5 || 0) +
      Number(numericCounts.C6 || 0),
    average_olevel_grade: round(mean, 2),
    count_weak_grades_olevel:
      Number(numericCounts.C6 || 0) +
      Number(numericCounts.P7 || 0) +
      Number(numericCounts.P8 || 0) +
      Number(numericCounts.F9 || 0),
    std_dev_olevel_grade: round(Math.sqrt(variance), 3),
  };
};

const deriveALevelFeatures = (subjects) => {
  const weights = subjects.map((grade) => GRADE_POINTS[grade] || 0);
  const mean =
    weights.length > 0
      ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length
      : 0;
  const variance =
    weights.length > 0
      ? weights.reduce((sum, weight) => sum + (weight - mean) ** 2, 0) /
        weights.length
      : 0;
  const std = Math.sqrt(variance);

  const freq = new Map();
  weights.forEach((weight) => {
    freq.set(weight, (freq.get(weight) || 0) + 1);
  });
  const dominantWeight =
    weights.length === 0
      ? 0
      : [...freq.entries()].sort((a, b) =>
          a[1] === b[1] ? b[0] - a[0] : b[1] - a[1]
        )[0][0];

  const varianceRounded = round(std, 3);
  const stability =
    varianceRounded > 0 ? round(1 / (1 + varianceRounded), 3) : 1;

  return {
    alevel_average_grade_weight: round(mean, 2),
    alevel_std_dev_grade_weight: varianceRounded,
    alevel_dominant_grade_weight: dominantWeight,
    alevel_count_weak_grades: subjects.filter((grade) => ["D", "E", "F"].includes(grade)).length,
    high_school_performance_variance: varianceRounded,
    high_school_performance_stability_index: stability,
  };
};

const buildProfileData = ({
  age_at_entry,
  marital_status,
  is_national,
  gender,
  level,
  year_of_entry_code,
  uce_year_code,
  uace_year_code,
  general_paper,
  campus_id_code,
  program_id_code,
  olevelCounts,
  alevelSubjects,
}) => {
  const olevel = deriveOLevelFeatures(olevelCounts);
  const alevel = deriveALevelFeatures(alevelSubjects);

  return {
    age_at_entry,
    marital_status,
    is_national,
    gender,
    level,
    year_of_entry_code,
    uce_year_code,
    uace_year_code,
    general_paper,
    campus_id_code,
    program_id_code,

    ...olevel,
    ...alevel,

    olevel_mode: "numeric",
    olevel_numericCounts: { ...olevelCounts },
    olevel_letterCounts: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
    _alevel_grading: "LEGACY_25",
    _alevel_principalCount: alevelSubjects.length,
    _alevel_subjects: [...alevelSubjects],
  };
};

export const DEMO_STUDENT_PROFILES = [
  {
    id: "high-performance-stem",
    title: "Profile A: High-Performance STEM",
    description:
      "Strong O-Level and A-Level performance with stable trend and science-oriented program choice.",
    data: buildProfileData({
      age_at_entry: 19,
      marital_status: 0,
      is_national: 1,
      gender: 1,
      level: 1,
      year_of_entry_code: 2024,
      uce_year_code: 2020,
      uace_year_code: 2022,
      general_paper: 1,
      campus_id_code: 2,
      program_id_code: 71,
      olevelCounts: { D1: 3, D2: 2, C3: 2, C4: 1, C5: 0, C6: 0, P7: 0, P8: 0, F9: 0 },
      alevelSubjects: ["A", "A", "B", "B"],
    }),
  },
  {
    id: "balanced-education",
    title: "Profile B: Balanced Education",
    description:
      "Moderate performance profile with mixed strengths, suitable for demonstrating mid-range outcomes.",
    data: buildProfileData({
      age_at_entry: 21,
      marital_status: 0,
      is_national: 1,
      gender: 0,
      level: 1,
      year_of_entry_code: 2023,
      uce_year_code: 2019,
      uace_year_code: 2021,
      general_paper: 1,
      campus_id_code: 1,
      program_id_code: 131,
      olevelCounts: { D1: 1, D2: 1, C3: 2, C4: 2, C5: 1, C6: 1, P7: 0, P8: 0, F9: 0 },
      alevelSubjects: ["B", "C", "C", "D"],
    }),
  },
  {
    id: "support-required",
    title: "Profile C: Support-Required",
    description:
      "Higher weak-grade concentration profile, useful to discuss advisories and early-support interventions.",
    data: buildProfileData({
      age_at_entry: 23,
      marital_status: 2,
      is_national: 1,
      gender: 1,
      level: 0,
      year_of_entry_code: 2022,
      uce_year_code: 2018,
      uace_year_code: 2020,
      general_paper: 0,
      campus_id_code: 1,
      program_id_code: 9,
      olevelCounts: { D1: 0, D2: 0, C3: 1, C4: 1, C5: 2, C6: 2, P7: 1, P8: 1, F9: 0 },
      alevelSubjects: ["C", "D", "E", "F"],
    }),
  },
  {
    id: "mature-postgraduate",
    title: "Profile D: Mature Postgraduate",
    description:
      "Older-entry profile with postgraduate pathway, included to show age and trajectory diversity.",
    data: buildProfileData({
      age_at_entry: 28,
      marital_status: 1,
      is_national: 0,
      gender: 0,
      level: 2,
      year_of_entry_code: 2025,
      uce_year_code: 2015,
      uace_year_code: 2017,
      general_paper: 1,
      campus_id_code: 1,
      program_id_code: 209,
      olevelCounts: { D1: 2, D2: 2, C3: 2, C4: 1, C5: 1, C6: 1, P7: 0, P8: 0, F9: 0 },
      alevelSubjects: ["A", "B", "C", "C"],
    }),
  },
];

