import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AIFeedbackResult {
  collaborator: string;
  management: string;
}

export async function generateFeedback(
  collaboratorName: string,
  metrics: any, // Scores dict
  comments: string,
  templateType: 'staff' | 'operativo'
): Promise<AIFeedbackResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      collaborator: "Feedback no disponible temporalmente (API Key no configurada).",
      management: "Recomendaciones no disponibles temporalmente."
    };
  }

  const roleLabel = templateType === 'staff' ? 'STAFF (Mano de Obra Indirecta)' : 'OPERATIVO (Mano de Obra Directa)';

  const prompt = `
    Eres un experto en gestión de personas y liderazgo industrial. Tu tono es profesional, objetivo y analítico.
    Tu objetivo es proporcionar dos informes distintos basados en la evaluación de desempeño de: ${collaboratorName}.

    PERFIL: ${roleLabel}
    Métricas Promedio (escala 1-4):
    - Prevención (Seguridad): ${metrics.prevencion || 0}
    - Calidad Técnica: ${metrics.calidad || 0}
    - Conducta y Ética: ${metrics.conducta || 0}
    - Desempeño y Productividad: ${metrics.desempeno || 0}

    Comentarios del evaluador: ${comments}

    REQUISITOS DEL INFORME:
    1. Informe para el Colaborador: Motivador, constructivo, destaca fortalezas y señala áreas de mejora con empatía. El objetivo es que se sienta valorado y orientado.
    2. Informe para la Gerencia: Analítico, directo, identifica riesgos (por ejemplo, si tiene bajo puntaje en prevención), sugiere acciones de capacitación, refuerzo, o movilidad interna. Identifica si el colaborador es un talento a retener o requiere intervención urgente.

    FORMATO DE RESPUESTA:
    Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
    {
      "collaborator": "texto del informe para el colaborador...",
      "management": "texto del informe para la gerencia..."
    }

    Idioma: Español. No incluyas markdown adicional fuera del JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.8,
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      collaborator: result.collaborator || "No se pudo generar el informe del colaborador.",
      management: result.management || "No se pudieron generar las sugerencias a gerencia."
    };
  } catch (error) {
    console.error("Error generating feedback:", error);
    return {
      collaborator: "Ocurrió un error al generar la retroalimentación.",
      management: "Ocurrió un error al generar las recomendaciones."
    };
  }
}
