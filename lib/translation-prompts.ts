// 翻译提示词管理工具
import { TargetLanguage } from '@/types/pdf-processor';

export interface TranslationPrompts {
  systemPrompt: string;
  userPromptTemplate: string;
}

/**
 * 根据目标语言获取预设的翻译提示词
 * 参考 simple/app.js 中的 getTranslationPrompts 函数
 */
export function getPredefinedTranslationPrompts(
  targetLanguage: TargetLanguage,
  customTargetLanguage?: string
): TranslationPrompts {
  const langLower = targetLanguage.toLowerCase();
  let sys_prompt = '';
  let user_prompt_template = '';

  // 确定最终的目标语言显示名称
  const targetLangDisplayName = targetLanguage === 'custom' && customTargetLanguage
    ? customTargetLanguage.trim() || 'English'
    : targetLanguage;

  switch (langLower) {
    case 'chinese':
      sys_prompt = "你是一个专业的文档翻译助手，擅长将文本精确翻译为简体中文，同时保留原始的 Markdown 格式。";
      user_prompt_template = `请将以下内容翻译为 **简体中文**。\n要求:\n\n1. 保持所有 Markdown 语法元素不变（如 # 标题、 *斜体*、 **粗体**、 [链接]()、 ![图片]() 等）。\n2. 学术/专业术语应准确翻译。\n3. 保持原文的段落结构和格式。\n4. 仅输出翻译后的内容，不要包含任何额外的解释或注释。\n5. 对于行间公式，使用 $$...$$ 标记。\n\n文档内容:\n\n\${content}`;
      break;
    case 'japanese':
      sys_prompt = "あなたはプロの文書翻訳アシスタントで、テキストを正確に日本語に翻訳し、元の Markdown 形式を維持することに長けています。";
      user_prompt_template = `以下の内容を **日本語** に翻訳してください。\n要件:\n\n1. すべての Markdown 構文要素（例: # 見出し、 *イタリック*、 **太字**、 [リンク]()、 ![画像]() など）は変更しないでください。\n2. 学術/専門用語は正確に翻訳してください。\n3. 元の段落構造と書式を維持してください。\n4. 翻訳された内容のみを出力し、余分な説明や注釈は含めないでください。\n5. 表示数式には $$...$$ を使用してください。\n\nドキュメント内容:\n\n\${content}`;
      break;
    case 'korean':
      sys_prompt = "당신은 전문 문서 번역 어시스턴트로, 텍스트를 정확하게 한국어로 번역하면서 원본 Markdown 형식을 유지하는 데 능숙합니다.";
      user_prompt_template = `다음 내용을 **한국어**로 번역해 주세요.\n요구사항:\n\n1. 모든 Markdown 구문 요소(예: # 제목, *기울임*, **굵게**, [링크](), ![이미지]() 등)를 변경하지 마세요.\n2. 학술/전문 용어를 정확하게 번역하세요.\n3. 원본의 단락 구조와 형식을 유지하세요.\n4. 번역된 내용만 출력하고, 추가 설명이나 주석은 포함하지 마세요.\n5. 수식 표시에는 $$...$$ 를 사용하세요.\n\n문서 내용:\n\n\${content}`;
      break;
    case 'french':
      sys_prompt = "Vous êtes un assistant de traduction de documents professionnel, expert dans la traduction précise de textes en français tout en préservant le format Markdown original.";
      user_prompt_template = `Veuillez traduire le contenu suivant en **Français**。\nExigences:\n\n1. Conserver tous les éléments de syntaxe Markdown inchangés (par exemple, # titres, *italique*, **gras**, [liens](), ![images]()).\n2. Traduire avec précision les termes académiques/professionnels.\n3. Maintenir la structure et le formatage des paragraphes d'origine.\n4. Produire uniquement le contenu traduit, sans explications ni annotations supplémentaires.\n5. Pour les formules mathématiques, utiliser \$\$...\$\$.\n\nContenu du document:\n\n\${content}`;
      break;
    case 'english':
      sys_prompt = "You are a professional document translation assistant, skilled at accurately translating text into English while preserving the original document format.";
      user_prompt_template = `Please translate the following content into **English**. \nRequirements:\n\n1. Keep all Markdown syntax elements unchanged (e.g., #headings, *italics*, **bold**, [links](), ![images]()).\n2. Translate academic/professional terms accurately.\n3. Maintain the original paragraph structure and formatting.\n4. Translate only the content; do not add extra explanations.\n5. For display math formulas, use:\n\$\$\n...\n\$\$\n\nDocument Content:\n\n\${content}`;
      break;
    default:
      // 自定义语言或其他语言
      sys_prompt = "You are a professional document translation assistant, skilled at accurately translating text into the target language while preserving the original document format.";
      user_prompt_template = `Please translate the following content into **${targetLangDisplayName}**. \nRequirements:\n\n1. Keep all Markdown syntax elements unchanged (e.g., #headings, *italics*, **bold**, [links](), ![images]()).\n2. Translate academic/professional terms accurately. If necessary, keep the original term in parentheses if unsure about the translation in ${targetLangDisplayName}.\n3. Maintain the original paragraph structure and formatting.\n4. Translate only the content; do not add extra explanations.\n5. For display math formulas, use:\n\$\$\n...\n\$\$\n\nDocument Content:\n\n\${content}`;
      break;
  }

  return { 
    systemPrompt: sys_prompt, 
    userPromptTemplate: user_prompt_template 
  };
}

/**
 * 获取最终使用的翻译提示词
 * 如果启用了自定义提示词且提供了自定义内容，则使用自定义的；否则使用预设的
 */
export function getFinalTranslationPrompts(
  targetLanguage: TargetLanguage,
  customTargetLanguage: string,
  useCustomPrompts: boolean,
  customSystemPrompt: string,
  customUserPromptTemplate: string
): TranslationPrompts {
  if (useCustomPrompts && customSystemPrompt.trim() && customUserPromptTemplate.trim()) {
    return {
      systemPrompt: customSystemPrompt.trim(),
      userPromptTemplate: customUserPromptTemplate.trim()
    };
  }

  return getPredefinedTranslationPrompts(targetLanguage, customTargetLanguage);
}

/**
 * 替换用户提示词模板中的内容占位符
 */
export function replaceContentPlaceholder(template: string, content: string): string {
  return template.replace(/\$\{content\}/g, content);
}
