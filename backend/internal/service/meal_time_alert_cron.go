package service

import (
	"context"
	"log"

	"github.com/robfig/cron/v3"
)

type MealTimeAlertCron struct {
	cron   *cron.Cron
	logger *log.Logger
}

func NewMealTimeAlertCron(alertService *MealTimeAlertService, logger *log.Logger) (*MealTimeAlertCron, error) {
	c := cron.New()
	if _, err := c.AddFunc("@every 1m", func() {
		if err := alertService.ScanAndAlert(context.Background()); err != nil {
			logger.Printf("[漏餐扫描失败] err=%v", err)
		}
	}); err != nil {
		return nil, err
	}
	return &MealTimeAlertCron{
		cron:   c,
		logger: logger,
	}, nil
}

func (c *MealTimeAlertCron) Start() {
	c.cron.Start()
	c.logger.Printf("meal-time alert cron started")
}

func (c *MealTimeAlertCron) Stop() {
	ctx := c.cron.Stop()
	<-ctx.Done()
	c.logger.Printf("meal-time alert cron stopped")
}
