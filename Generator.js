/**
 * Generator.js
 * Aptitude questions generated via Azure OpenAI based on course name.
 */

const axios = require("axios");

function getDifficultyByCourse(course) {
    const name = String(course || "").toLowerCase();

    if (name.includes("mtech")) return "HARD";
    if (name.includes("mca") || name.includes("btech")) return "MEDIUM";
    if (name.includes("bca") || name.includes("bsc")) return "EASY";

    return "MEDIUM";
}

function getAzureConfig() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "";
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "";
    const apiKey = process.env.AZURE_OPENAI_API_KEY || "";

    if (!endpoint || !deployment || !apiVersion || !apiKey) {
        throw new Error("Azure OpenAI config missing in environment");
    }

    return { endpoint, deployment, apiVersion, apiKey };
}

function buildPrompt(course, difficulty, count, avoidList) {
    const avoidText = avoidList && avoidList.length > 0
        ? `Avoid these exact question texts:\n${avoidList.map(q => `- ${q}`).join("\n")}\n`
        : "";

    return `
Generate ${count} quantitative aptitude questions for the course "${course}".
Difficulty should be ${difficulty}.
Focus mainly on quantitative aptitude (percentages, ratios, time-speed-distance, algebra, number systems, probability, permutations/combinations, work/time, averages).
You may include a small number of reasoning questions, but avoid subject-specific technical questions.
${avoidText}
Return ONLY a JSON array of objects with these exact keys:
question_text, option_a, option_b, option_c, option_d, correct_answer
Rules:
- correct_answer must be one of: A, B, C, D
- exactly 4 options, only one correct
- no markdown, no extra text
- make questions different from each other
`;
}

function extractJsonArray(text) {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
    } catch (_) {
        // fall through to extraction
    }

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice);
        if (Array.isArray(parsed)) return parsed;
    }

    throw new Error("Failed to parse JSON array from model response");
}

function normalizeQuestion(q) {
    const questionText = String(q.question_text || "").trim();
    const optionA = String(q.option_a || "").trim();
    const optionB = String(q.option_b || "").trim();
    const optionC = String(q.option_c || "").trim();
    const optionD = String(q.option_d || "").trim();
    const correct = String(q.correct_answer || "").trim().toUpperCase();

    if (!questionText || !optionA || !optionB || !optionC || !optionD) return null;
    if (!["A", "B", "C", "D"].includes(correct)) return null;

    return {
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: correct
    };
}

async function callAzure(messages) {
    const { endpoint, deployment, apiVersion, apiKey } = getAzureConfig();
    const url = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await axios.post(
        url,
        {
            messages,
            temperature: 0.7
        },
        {
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey
            }
        }
    );

    return response.data;
}

function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
}

async function generateBatch(course, difficulty, count, avoidList) {
    const prompt = buildPrompt(course, difficulty, count, avoidList);
    const data = await callAzure([
        {
            role: "system",
            content: "You generate aptitude questions and output strict JSON only."
        },
        {
            role: "user",
            content: prompt
        }
    ]);

    const content = data?.choices?.[0]?.message?.content || "";
    const rawArray = extractJsonArray(content);
    const normalized = rawArray
        .map(normalizeQuestion)
        .filter(Boolean);

    if (normalized.length === 0) {
        throw new Error("Model returned no valid questions");
    }

    return normalized;
}

async function generateQuestionsForCourse(course, count = 10) {
    const cleanedCourse = String(course || "").trim();
    const difficulty = getDifficultyByCourse(cleanedCourse);

    const unique = new Map();
    const maxAttempts = 3;
    let attempt = 0;

    while (unique.size < count && attempt < maxAttempts) {
        const remaining = count - unique.size;
        const avoidList = Array.from(unique.keys());
        const batch = await generateBatch(cleanedCourse, difficulty, remaining, avoidList);

        for (const q of batch) {
            const key = q.question_text.toLowerCase();
            if (!unique.has(key)) unique.set(key, q);
        }

        attempt += 1;
    }

    const result = Array.from(unique.values()).slice(0, count);
    shuffleInPlace(result);
    return result;
}

module.exports = {
    generateQuestionsForCourse
};
