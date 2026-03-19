package service

import (
	"context"
)

type AiAdviceResult struct {
	Type    string
	Advice  string
	IsAlert bool
}

type AiAdviceService struct{}

func NewAiAdviceService() *AiAdviceService {
	return &AiAdviceService{}
}

// GetMeAiAdvice v4.2：云端 AI 智能营养师（当前实现为规则占位，避免依赖第三方 LLM）
// 若后续接入真实 LLM，可在此处替换 Advice 生成逻辑。
func (s *AiAdviceService) GetMeAiAdvice(ctx context.Context, userID string, adviceType string) (AiAdviceResult, error) {
	_ = ctx
	_ = userID

	switch adviceType {
	case "meal_review":
		return AiAdviceResult{
			Type:    adviceType,
			Advice:  "吃这么快赶火车吗？今天的口感组合很丰富，但也别忘了配点蔬菜和慢慢嚼！",
			IsAlert: false,
		}, nil
	case "daily_alert":
		return AiAdviceResult{
			Type:    adviceType,
			Advice:  "今日累计摄入偏高/偏快的风险较明显：建议下顿先补充蔬菜与水分，并放慢用餐节奏。",
			IsAlert: true,
		}, nil
	case "next_meal":
		return AiAdviceResult{
			Type:    adviceType,
			Advice:  "明天的 4 格建议：主食少量搭配优质蛋白（如鱼/鸡蛋）、增加绿叶菜与汤品，尽量让口感更均衡。",
			IsAlert: false,
		}, nil
	default:
		return AiAdviceResult{}, ErrInvalidInput
	}
}

