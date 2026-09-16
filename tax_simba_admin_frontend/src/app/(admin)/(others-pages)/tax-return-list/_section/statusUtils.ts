import { statusSteps } from "@/utils/taxReturnUtils";

  export const getStatusLabel = (status: string) => {
    const step = statusSteps.find(s => s.key === status);
    return step ? step.label : status;
  };