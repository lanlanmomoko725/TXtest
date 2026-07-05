import { Link } from "react-router";

const sections = [
  {
    title: "一、协议范围",
    content:
      "本协议适用于你访问、注册和使用天象志网站及相关功能。你完成注册、登录、发布内容或继续使用本网站，即表示你已阅读并同意本协议。",
  },
  {
    title: "二、账号使用",
    content:
      "你应提供真实、准确、可用的注册信息，并妥善保管账号、密码、手机号、邮箱和验证码。因你主动泄露、转借账号或使用弱密码造成的损失，由你自行承担。",
  },
  {
    title: "三、内容发布与审核",
    content:
      "你可以在本网站发布天象观察、文章、图片、评论和回复等内容。普通用户的部分资料修改、评论或其他内容可能需要管理员审核后公开。本网站有权对违法违规、侵犯他人权益、影响社区秩序或与天象主题明显无关的内容进行隐藏、删除、拒绝发布或限制账号使用。",
  },
  {
    title: "四、图片与版权声明",
    content:
      "你上传头像、帖子图片、文章图片、封面图或其他图片时，应确认自己拥有版权、肖像权、使用授权或其他合法来源。图片版权仍归原权利人所有；除非另有明确说明，你授权天象志在提供网站功能所必需的范围内，对你上传的图片进行展示、缓存、压缩、生成缩略图、设为封面、用于内容列表和详情页展示。你不得上传盗版图片、未经授权的摄影作品、含他人隐私或侵犯他人合法权益的图片。因你上传图片引发的争议、投诉或损失，由你自行承担；本网站收到合理投诉后可先行限制展示或删除相关图片。",
  },
  {
    title: "五、禁止行为",
    content:
      "你不得利用本网站发布违法违规、暴力色情、骚扰欺诈、恶意营销、侵犯知识产权、泄露他人隐私、破坏系统安全、批量抓取数据或干扰正常服务的内容或行为。",
  },
  {
    title: "六、服务变更与风险",
    content:
      "本网站会尽力保持服务稳定，但可能因维护、升级、网络、第三方服务、不可抗力或安全事件导致服务中断、延迟或数据展示异常。涉及阿里云验证码、短信、邮件、图片存储等第三方能力时，还可能受第三方服务状态影响。",
  },
  {
    title: "七、责任限制",
    content:
      "用户发布内容仅代表发布者观点，不代表本网站立场。你应自行判断天象观测信息、活动信息和用户内容的准确性，并对基于相关信息采取的行动负责。",
  },
  {
    title: "八、协议更新",
    content:
      "本网站可根据功能变化、合规要求或运营需要更新本协议。更新后会通过页面展示或站内提示告知，继续使用本网站即视为接受更新后的内容。",
  },
];

export default function UserAgreement() {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-8 border-b border-border/70 pb-6">
          <p className="text-sm text-muted-foreground">天象志协议文件</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">用户协议</h1>
          <p className="mt-3 text-sm text-muted-foreground">生效日期：2026年7月5日</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-foreground sm:text-base">
          <p>
            欢迎使用天象志。天象志是面向天象爱好者的内容分享社区，提供天象记录、文章、图片、评论和活动信息等功能。请在使用前仔细阅读本协议。
          </p>

          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <p className="text-muted-foreground">{section.content}</p>
            </section>
          ))}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">九、联系我们</h2>
            <p className="text-muted-foreground">
              如你对本协议、内容版权或图片侵权处理有疑问，可以通过网站公布的联系方式或管理员渠道与我们联系。隐私相关事项请同时阅读
              <Link to="/privacy-policy" className="mx-1 text-primary hover:underline">
                《隐私条款》
              </Link>
              。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
