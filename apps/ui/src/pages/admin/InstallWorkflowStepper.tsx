import { Step, StepContent, StepLabel, Stepper, Typography } from "@mui/material";
import { ESPHOME_INSTALL_STEPS } from "../../lib/esphome-install-guide";

type Props = {
  /** Which install step is current (0 = first step). */
  activeStep: number;
};

/** Install workflow on Add device wizard — plain-language steps. */
export function InstallWorkflowStepper({ activeStep }: Props) {
  return (
    <Stepper activeStep={activeStep} orientation="vertical" nonLinear>
      {ESPHOME_INSTALL_STEPS.map((step, index) => (
        <Step key={step.id} completed={index < activeStep} expanded>
          <StepLabel>{step.title}</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              {step.detail}
            </Typography>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  );
}
