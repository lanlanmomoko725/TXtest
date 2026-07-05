import { Link } from "react-router";

const sections = [
  {
    title: "一、我们收集的信息",
    content:
      "在你注册、登录和使用天象志时，我们可能收集手机号、邮箱、用户名、头像、密码加密结果、验证码验证结果、登录会话、IP 地址、设备和浏览器信息、操作日志、发帖记录、评论回复、图片地址、封面选择、审核状态等信息。",
  },
  {
    title: "二、信息使用目的",
    content:
      "我们使用上述信息用于账号注册和登录、验证码校验、身份识别、内容发布、评论审核、资料审核、图片展示、封面生成、点赞统计、安全风控、异常排查、服务通知和网站功能优化。",
  },
  {
    title: "三、图片与公开内容",
    content:
      "你主动上传或发布的头像、帖子图片、文章图片、封面图、评论内容和其他公开内容，可能会根据发布状态、审核结果和页面功能向其他用户展示。请勿上传包含身份证件、精确住址、联系方式、未授权肖像、未授权作品或其他敏感隐私的图片和内容。",
  },
  {
    title: "四、审核与管理查看",
    content:
      "为处理资料审核、评论审核、内容投诉、版权争议、安全风险和违规行为，管理员可能查看你提交的头像、图片、文字内容、审核记录和相关操作日志。管理员仅应在实现网站管理和安全合规目的所必需的范围内查看和处理相关信息。",
  },
  {
    title: "五、存储与安全",
    content:
      "我们会采用合理的技术和管理措施保护你的信息，例如密码加密存储、登录会话管理、权限校验和上传校验。但互联网环境并非绝对安全，请你妥善保管账号、密码、手机号、邮箱和验证码。",
  },
  {
    title: "六、第三方服务",
    content:
      "本网站可能使用阿里云 CAPTCHA、阿里云短信验证、SMTP 邮件服务、图片上传和服务器托管等第三方能力。相关服务可能在完成验证码、安全验证、邮件发送、短信发送、图片处理和服务运行所必需的范围内处理必要信息。",
  },
  {
    title: "七、信息共享",
    content:
      "除获得你的授权、履行法律法规要求、处理投诉争议、维护网站安全或保护用户合法权益外，我们不会向无关第三方出售或非法提供你的个人信息。",
  },
  {
    title: "八、Cookie 与会话",
    content:
      "为了保持登录状态、识别账号和保障安全，本网站会使用 Cookie 或同类技术保存必要的会话信息。你可以通过浏览器设置管理 Cookie，但关闭后可能影响登录和部分功能使用。",
  },
  {
    title: "九、你的权利",
    content:
      "你可以在网站提供的功能范围内查看、修改账号资料，申请更换头像或用户名，绑定或更换手机号和邮箱，删除自己有权删除的内容。对无法自行处理的事项，可以联系管理员协助。",
  },
  {
    title: "十、未成年人保护",
    content:
      "未成年人使用本网站前，应取得监护人同意并在监护人指导下使用。监护人如发现未成年人信息被不当提交，可以联系管理员处理。",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-8 border-b border-border/70 pb-6">
          <p className="text-sm text-muted-foreground">天象志协议文件</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">隐私条款</h1>
          <p className="mt-3 text-sm text-muted-foreground">生效日期：2026年7月5日</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-foreground sm:text-base">
          <p>
            天象志重视用户隐私和内容安全。本条款说明我们在提供天象记录、图片展示、文章发布、评论互动和活动信息等功能时如何收集、使用和保护信息。
          </p>

          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <p className="text-muted-foreground">{section.content}</p>
            </section>
          ))}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">十一、条款更新与联系</h2>
            <p className="text-muted-foreground">
              我们可能根据功能变化、法律要求或安全需要更新本条款。你继续使用本网站即视为接受更新后的条款。关于账号、隐私、图片版权或内容投诉事项，可以通过网站公布的联系方式或管理员渠道与我们联系。你也可以阅读
              <Link to="/user-agreement" className="mx-1 text-primary hover:underline">
                《用户协议》
              </Link>
              了解内容发布和版权规则。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
