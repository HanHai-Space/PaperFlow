// API 相关工具函数与管理器
import { ApiKeyManager, TranslationConfig, OcrResponse, TranslationModel, CustomRequestFormat } from '@/types/pdf-processor';

// 增强的API Key 管理器类 - 支持并发和智能重试
class ApiKeyManagerImpl implements ApiKeyManager {
  mistralKeys: string[] = [];
  translationKeys: string[] = [];
  mistralKeyIndex: number = 0;
  translationKeyIndex: number = 0;
  private mistralBlacklist: string[] = [];
  private translationBlacklist: string[] = [];

  // 新增：密钥使用统计
  private mistralKeyUsage: Map<string, { count: number; lastUsed: number; errors: number }> = new Map();
  private translationKeyUsage: Map<string, { count: number; lastUsed: number; errors: number }> = new Map();

  parseKeys(keyType: 'mistral' | 'translation'): boolean {
    // 在React组件中，这个方法会被重写来从state获取keys
    return false;
  }

  setKeys(keyType: 'mistral' | 'translation', keys: string[]): void {
    if (keyType === 'mistral') {
      this.mistralKeys = keys;
      this.mistralKeyIndex = 0;
      this.mistralBlacklist = [];
      // 初始化使用统计
      this.mistralKeyUsage.clear();
      keys.forEach(key => {
        this.mistralKeyUsage.set(key, { count: 0, lastUsed: 0, errors: 0 });
      });
    } else {
      this.translationKeys = keys;
      this.translationKeyIndex = 0;
      this.translationBlacklist = [];
      // 初始化使用统计
      this.translationKeyUsage.clear();
      keys.forEach(key => {
        this.translationKeyUsage.set(key, { count: 0, lastUsed: 0, errors: 0 });
      });
    }
  }

  // 获取下一个可用密钥（轮询方式）
  private getNextKey(keyType: 'mistral' | 'translation'): string | null {
    const keys = keyType === 'mistral' ? this.mistralKeys : this.translationKeys;
    const blacklist = keyType === 'mistral' ? this.mistralBlacklist : this.translationBlacklist;

    if (keys.length === 0) return null;

    const availableKeys = keys.filter(k => !blacklist.includes(k));
    if (availableKeys.length === 0) return null;

    const index = keyType === 'mistral' ? this.mistralKeyIndex : this.translationKeyIndex;
    const currentIndex = index % availableKeys.length;
    const key = availableKeys[currentIndex];

    // 更新索引
    if (keyType === 'mistral') {
      this.mistralKeyIndex = (currentIndex + 1) % availableKeys.length;
    } else {
      this.translationKeyIndex = (currentIndex + 1) % availableKeys.length;
    }

    // 更新使用统计
    const usage = keyType === 'mistral' ? this.mistralKeyUsage : this.translationKeyUsage;
    const stats = usage.get(key);
    if (stats) {
      stats.count++;
      stats.lastUsed = Date.now();
    }

    return key;
  }

  // 获取指定的密钥（用于重试时切换）
  getSpecificKey(keyType: 'mistral' | 'translation', excludeKeys: string[] = []): string | null {
    const keys = keyType === 'mistral' ? this.mistralKeys : this.translationKeys;
    const blacklist = keyType === 'mistral' ? this.mistralBlacklist : this.translationBlacklist;

    const availableKeys = keys.filter(k =>
      !blacklist.includes(k) && !excludeKeys.includes(k)
    );

    if (availableKeys.length === 0) return null;

    // 选择使用次数最少的密钥
    const usage = keyType === 'mistral' ? this.mistralKeyUsage : this.translationKeyUsage;
    const sortedKeys = availableKeys.sort((a, b) => {
      const statsA = usage.get(a) || { count: 0, lastUsed: 0, errors: 0 };
      const statsB = usage.get(b) || { count: 0, lastUsed: 0, errors: 0 };
      return statsA.count - statsB.count;
    });

    const key = sortedKeys[0];

    // 更新使用统计
    const stats = usage.get(key);
    if (stats) {
      stats.count++;
      stats.lastUsed = Date.now();
    }

    return key;
  }

  getMistralKey(): string {
    return this.getNextKey('mistral') || '';
  }

  getTranslationKey(): string {
    return this.getNextKey('translation') || '';
  }

  // 获取多个翻译密钥（用于并发处理）
  getMultipleTranslationKeys(count: number): string[] {
    const keys: string[] = [];
    const usedKeys = new Set<string>();

    for (let i = 0; i < count; i++) {
      const key = this.getSpecificKey('translation', Array.from(usedKeys));
      if (key) {
        keys.push(key);
        usedKeys.add(key);
      } else {
        break; // 没有更多可用密钥
      }
    }

    return keys;
  }

  markKeyInvalid(keyType: 'mistral' | 'translation', key: string): void {
    const blacklist = keyType === 'mistral' ? this.mistralBlacklist : this.translationBlacklist;
    if (!blacklist.includes(key)) {
      blacklist.push(key);
      console.warn(`Key 被标记为失效并加入黑名单: ${keyType} (...${key.slice(-4)})`);
    }

    // 更新错误统计
    const usage = keyType === 'mistral' ? this.mistralKeyUsage : this.translationKeyUsage;
    const stats = usage.get(key);
    if (stats) {
      stats.errors++;
    }
  }

  // 记录密钥错误（不加入黑名单，用于重试逻辑）
  recordKeyError(keyType: 'mistral' | 'translation', key: string): void {
    const usage = keyType === 'mistral' ? this.mistralKeyUsage : this.translationKeyUsage;
    const stats = usage.get(key);
    if (stats) {
      stats.errors++;
    }
  }

  // 获取密钥使用统计
  getKeyStats(keyType: 'mistral' | 'translation'): Array<{key: string; count: number; errors: number; lastUsed: number}> {
    const usage = keyType === 'mistral' ? this.mistralKeyUsage : this.translationKeyUsage;
    const keys = keyType === 'mistral' ? this.mistralKeys : this.translationKeys;

    return keys.map(key => {
      const stats = usage.get(key) || { count: 0, lastUsed: 0, errors: 0 };
      return {
        key: `...${key.slice(-4)}`,
        count: stats.count,
        errors: stats.errors,
        lastUsed: stats.lastUsed
      };
    });
  }

  // 重置密钥黑名单（用于新的处理会话）
  resetBlacklist(keyType?: 'mistral' | 'translation'): void {
    if (!keyType || keyType === 'mistral') {
      this.mistralBlacklist = [];
    }
    if (!keyType || keyType === 'translation') {
      this.translationBlacklist = [];
    }
  }

  // 获取可用密钥数量
  getAvailableKeyCount(keyType: 'mistral' | 'translation'): number {
    const keys = keyType === 'mistral' ? this.mistralKeys : this.translationKeys;
    const blacklist = keyType === 'mistral' ? this.mistralBlacklist : this.translationBlacklist;
    return keys.filter(k => !blacklist.includes(k)).length;
  }
}

// 创建全局实例
export const apiKeyManager = new ApiKeyManagerImpl();

// API 错误信息提取工具
export async function getApiError(response: Response, defaultMessage: string): Promise<string> {
  let errorInfo = defaultMessage;
  try {
    const responseText = await response.text();
    console.error('API Error Response Text:', responseText);
    try {
      const jsonError = JSON.parse(responseText);
      errorInfo = jsonError.error?.message || jsonError.message || jsonError.detail || JSON.stringify(jsonError);
    } catch (e) {
      errorInfo = responseText || `HTTP ${response.status} ${response.statusText}`;
    }
  } catch (e) {
    errorInfo = `${defaultMessage} (HTTP ${response.status} ${response.statusText})`;
  }
  return errorInfo;
}

// Mistral API 函数
export async function uploadToMistral(file: File, mistralKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'ocr');

  const response = await fetch('https://api.mistral.ai/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mistralKey}` },
    body: formData
  });

  if (!response.ok) {
    const errorInfo = await getApiError(response, '文件上传失败');
    if (response.status === 401) {
      throw new Error(`Mistral API Key (...${mistralKey.slice(-4)}) 无效或未授权`);
    }
    throw new Error(`文件上传失败 (${response.status}): ${errorInfo}`);
  }

  const fileData = await response.json();
  if (!fileData || !fileData.id) {
    throw new Error('上传成功但未返回有效的文件ID');
  }
  return fileData.id;
}

export async function getMistralSignedUrl(fileId: string, mistralKey: string): Promise<string> {
  const urlEndpoint = `https://api.mistral.ai/v1/files/${fileId}/url?expiry=24`;
  const response = await fetch(urlEndpoint, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${mistralKey}`, 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const errorInfo = await getApiError(response, '获取签名URL失败');
    throw new Error(`获取签名URL失败 (${response.status}): ${errorInfo}`);
  }

  const urlData = await response.json();
  if (!urlData || !urlData.url) {
    throw new Error('获取的签名URL格式不正确');
  }
  return urlData.url;
}

export async function callMistralOcr(signedUrl: string, mistralKey: string): Promise<OcrResponse> {
  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mistralKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: "document_url", document_url: signedUrl },
      include_image_base64: true
    })
  });

  if (!response.ok) {
    const errorInfo = await getApiError(response, 'OCR处理失败');
    throw new Error(`OCR处理失败 (${response.status}): ${errorInfo}`);
  }

  const ocrData = await response.json();
  if (!ocrData || !ocrData.pages) {
    throw new Error('OCR处理成功但返回的数据格式不正确');
  }
  return ocrData;
}

export async function deleteMistralFile(fileId: string, apiKey: string): Promise<void> {
  if (!fileId || !apiKey) return;

  const deleteUrl = `https://api.mistral.ai/v1/files/${fileId}`;
  try {
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      const errorInfo = await getApiError(response, '文件删除失败');
      console.warn(`Failed to delete Mistral file ${fileId}: ${response.status} - ${errorInfo}`);
    }
  } catch (error) {
    console.warn(`Error during Mistral file deletion ${fileId}:`, error);
  }
}

// 翻译 API 调用
export async function callTranslationApi(config: TranslationConfig, requestBody: any, abortSignal?: AbortSignal): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify(requestBody),
    signal: abortSignal
  });

  if (!response.ok) {
    const errorText = await getApiError(response, '翻译API返回错误');
    throw new Error(`翻译 API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const translatedContent = config.responseExtractor(data);

  if (translatedContent === null || translatedContent === undefined) {
    console.error(`Failed to extract translation from response:`, data);
    throw new Error('无法从 API 响应中提取翻译内容');
  }

  return translatedContent.trim();
}

// 构建预定义 API 配置
export function buildPredefinedApiConfig(model: TranslationModel, apiKey: string): TranslationConfig {
  const predefinedConfigs: Record<string, Partial<TranslationConfig>> = {
    "mistral": {
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
          { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
        ]
      }),
      responseExtractor: (data: any) => data?.choices?.[0]?.message?.content
    },
    "deepseek": {
      endpoint: "https://api.deepseek.com/v1/chat/completions",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
          { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
        ]
      }),
      responseExtractor: (data: any) => data?.choices?.[0]?.message?.content
    },
    "gemini": {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        contents: [{
          parts: [{
            text: (systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.`) + '\n\n' +
                  (userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content)
          }]
        }]
      }),
      responseExtractor: (data: any) => data?.candidates?.[0]?.content?.parts?.[0]?.text
    },
    "claude": {
      endpoint: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8000,
        system: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.`,
        messages: [{
          role: "user",
          content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content
        }]
      }),
      responseExtractor: (data: any) => data?.content?.[0]?.text
    },
    "tongyi-deepseek-v3": {
      endpoint: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "deepseek-v3",
        input: {
          messages: [
            { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
            { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
          ]
        }
      }),
      responseExtractor: (data: any) => data?.output?.text
    },
    "volcano-deepseek-v3": {
      endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "ep-20241230140207-8xqzr",
        messages: [
          { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
          { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
        ]
      }),
      responseExtractor: (data: any) => data?.choices?.[0]?.message?.content
    },
    "chutes-deepseek-v3": {
      endpoint: "https://llm.chutes.ai/v1/chat/completions",
      headers: { "Content-Type": "application/json" },
      requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages: [
          { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
          { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
        ],
        stream: false,
        max_tokens: 10000,
        temperature: 0
      }),
      responseExtractor: (data: any) => data?.choices?.[0]?.message?.content
    }
  };

  const config = predefinedConfigs[model];
  if (!config) {
    throw new Error(`Unsupported translation model: ${model}`);
  }

  const finalConfig: TranslationConfig = {
    endpoint: config.endpoint!,
    headers: { ...config.headers! },
    requestBuilder: config.requestBuilder!,
    responseExtractor: config.responseExtractor!
  };

  // 设置认证
  if (model === 'claude') {
    finalConfig.headers['x-api-key'] = apiKey;
  } else if (model === 'gemini') {
    const baseUrl = finalConfig.endpoint.split('?')[0];
    finalConfig.endpoint = `${baseUrl}?key=${apiKey}`;
  } else if (model === 'tongyi-deepseek-v3') {
    finalConfig.headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    finalConfig.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return finalConfig;
}

// 构建自定义 API 配置
export function buildCustomApiConfig(
  apiKey: string,
  endpoint: string,
  modelId: string,
  requestFormat: CustomRequestFormat,
  temperature: number = 0,
  maxTokens: number = 10000
): TranslationConfig {
  const config: TranslationConfig = {
    endpoint,
    headers: { 'Content-Type': 'application/json' },
    requestBuilder: (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({}),
    responseExtractor: (data: any) => ''
  };

  // 根据请求格式设置认证和构建器
  switch (requestFormat) {
    case 'openai':
      config.headers['Authorization'] = `Bearer ${apiKey}`;
      config.requestBuilder = (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.` },
          { role: "user", content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content }
        ],
        temperature,
        max_tokens: maxTokens
      });
      config.responseExtractor = (data: any) => data?.choices?.[0]?.message?.content;
      break;

    case 'anthropic':
      config.headers['x-api-key'] = apiKey;
      config.headers['anthropic-version'] = '2023-06-01';
      config.requestBuilder = (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.`,
        messages: [{
          role: "user",
          content: userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content
        }]
      });
      config.responseExtractor = (data: any) => data?.content?.[0]?.text;
      break;

    case 'gemini':
      const baseUrl = endpoint.split('?')[0];
      config.endpoint = `${baseUrl}?key=${apiKey}`;
      config.requestBuilder = (content: string, targetLanguage: string, systemPrompt?: string, userPromptTemplate?: string) => ({
        contents: [{
          parts: [{
            text: (systemPrompt || `You are a professional translator. Translate the following content to ${targetLanguage}.`) + '\n\n' +
                  (userPromptTemplate ? userPromptTemplate.replace('${content}', content).replace('${targetLangName}', targetLanguage) : content)
          }]
        }]
      });
      config.responseExtractor = (data: any) => data?.candidates?.[0]?.content?.parts?.[0]?.text;
      break;
  }

  return config;
}
