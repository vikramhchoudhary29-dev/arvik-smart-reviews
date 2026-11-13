export async function copyAndContinue(
  text: string,
  url: string,
  dependencies: {
    copy: (text: string) => Promise<void>;
    event: (type: string) => void;
    navigate: (url: string) => void;
    validate: (url: string) => boolean;
    copied: () => void;
  },
) {
  if (!text.trim()) throw Error('Please write a review first.');
  if (!dependencies.validate(url))
    throw Error('This Google destination is invalid. Please contact the business.');
  await dependencies.copy(text);
  dependencies.copied();
  try {
    dependencies.event('COPY_SUGGESTION');
    dependencies.event('GOOGLE_LINK_CLICK');
  } catch {}
  dependencies.navigate(url);
}
