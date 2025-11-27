export function removeTextFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold **text**
    .replace(/\*(.*?)\*/g, "$1") // Remove italic *text*
    .replace(/__(.*?)__/g, "$1") // Remove underline __text__
    .replace(/~~(.*?)~~/g, "$1") // Remove strikethrough ~~text~~
    .replace(/`(.*?)`/g, "$1") // Remove inline code `text`
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/#{1,6}\s*/g, "") // Remove headers # ## ###
    .replace(/^\s*[-*+]\s+/gm, "") // Remove bullet points
    .replace(/^\s*\d+\.\s+/gm, "") // Remove numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links [text](url)
    .replace(/\n+/g, " ") // Replace all newlines with spaces
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with single space
    .trim();
}
