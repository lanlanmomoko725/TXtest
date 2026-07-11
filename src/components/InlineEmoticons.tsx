import { tokenizeWeiboEmoticons } from "@/lib/weibo-emoticons";

interface InlineEmoticonsProps {
  text: string;
  className?: string;
}

export default function InlineEmoticons({ text, className }: InlineEmoticonsProps) {
  const tokens = tokenizeWeiboEmoticons(text);

  return (
    <span className={className}>
      {tokens.map((token, index) =>
        token.type === "text" ? (
          token.value
        ) : (
          <img
            key={`${token.alias}-${index}`}
            src={token.src}
            alt={`[${token.alias}]`}
            title={`[${token.alias}]`}
            loading="lazy"
            draggable={false}
            data-emoticon="true"
            className="mx-0.5 inline-block h-[1.35em] w-[1.35em] max-w-none align-[-0.22em] object-contain"
          />
        ),
      )}
    </span>
  );
}
