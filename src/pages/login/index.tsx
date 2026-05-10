import { Button, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common";
import { API_BASE_URL, API_BASE_URL_IS_LOCAL } from "@/constants/api";
import { LOCAL_API_UNAVAILABLE_ERROR } from "@/services/api";
import { useAuth } from "@/store/auth";

export default function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Taro.showToast({ title: "请填写邮箱和密码", icon: "none" });
      return;
    }

    if (mode === "register" && !nickname.trim()) {
      Taro.showToast({ title: "注册时请填写昵称", icon: "none" });
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        await auth.loginWithPassword(email.trim(), password);
      } else {
        await auth.registerWithPassword(email.trim(), password, nickname.trim());
      }

      Taro.reLaunch({ url: "/pages/home/index" });
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message === LOCAL_API_UNAVAILABLE_ERROR
          ? API_BASE_URL_IS_LOCAL
            ? "当前体验版还在请求本机后端。先把 API 切到公网地址再试。"
            : `后端暂时连不上：${API_BASE_URL}`
          : error instanceof Error
            ? error.message
            : "认证失败";

      Taro.showToast({
        title: errorMessage,
        icon: "none"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="page">
      <PageHeader
        title={mode === "login" ? "登录" : "注册"}
        subtitle="业务数据改为服务端持久化，先登录再进入你的攀岩日志。"
      />

      <Card>
        <View className="choice-group">
          <View className={`choice-chip ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
            登录
          </View>
          <View className={`choice-chip ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
            注册
          </View>
        </View>

        <View className="stack-md" style={{ marginTop: "20px" }}>
          {mode === "register" ? (
            <View>
              <Text className="field-label">昵称</Text>
              <Input className="input" value={nickname} placeholder="今天也在尝试的人" onInput={(e) => setNickname(e.detail.value)} />
            </View>
          ) : null}

          <View>
            <Text className="field-label">邮箱</Text>
            <Input className="input" value={email} placeholder="name@example.com" onInput={(e) => setEmail(e.detail.value)} />
          </View>

          <View>
            <Text className="field-label">密码</Text>
            <Input className="input" password value={password} placeholder="至少 6 位" onInput={(e) => setPassword(e.detail.value)} />
          </View>

          <Button className="primary-button" loading={submitting} onClick={handleSubmit}>
            {mode === "login" ? "进入我的日志" : "创建账号"}
          </Button>

          <View className="inline-note">
            当前接口：`{API_BASE_URL}`。本地开发先启动 `npm run server:start`，真机或朋友测试要改成可访问的公网 `https` 地址。
          </View>
        </View>
      </Card>
    </View>
  );
}
