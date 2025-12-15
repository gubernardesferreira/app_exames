import { GoogleGenAI, Type } from "@google/genai";

export async function getExamInfo(examName: string): Promise<string> {
  if (!examName) {
    return "";
  }
  
  if (!process.env.API_KEY) {
      return "A chave de API do Gemini não foi configurada. Não é possível buscar informações.";
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `Explique o exame "${examName}" (uso e valores de referência adultos BR). Resuma em markdown. Cite fontes.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text ?? "Não foi possível obter informações sobre este exame.";
  } catch (error) {
    console.error("Error fetching exam info from Gemini API:", error);
    return "Ocorreu um erro ao buscar informações sobre o exame. Verifique sua chave de API e a conexão com a internet.";
  }
}

export async function extractDataFromPdf(base64Data: string): Promise<any[]> {
  if (!process.env.API_KEY) {
    throw new Error("A chave de API não está configurada. Não é possível processar PDFs.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data
            }
          },
          {
            text: `Extraia resultados de exames deste PDF para JSON.
            Campos: date (YYYY-MM-DD), examType (categoria), examName (nome), value (número).
            Ignore textos que não sejam resultados de exames.`
          }
        ]
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              examType: { type: Type.STRING },
              examName: { type: Type.STRING },
              value: { type: Type.NUMBER }
            },
            required: ["date", "examType", "examName", "value"]
          }
        }
      }
    });

    let text = response.text;
    if (!text) return [];
    
    // Limpeza de segurança para remover markdown code blocks caso o modelo insira
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", text);
        throw new Error("O formato dos dados retornados pela IA é inválido.");
    }

  } catch (error) {
    console.error("Error processing PDF with Gemini:", error);
    throw new Error("Falha ao processar o PDF. Verifique se o arquivo é legível e contém exames laboratoriais.");
  }
}