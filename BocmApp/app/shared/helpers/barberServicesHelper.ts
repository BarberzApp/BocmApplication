export type Service = { name: string; price: number; duration: number };

export const addService = (setFormData: React.Dispatch<React.SetStateAction<any>>) => {
  setFormData((prev: any) => ({
    ...prev,
    services: [...prev.services, { name: '', price: 0, duration: 30 }],
  }));
};

export const removeService = (index: number, setFormData: React.Dispatch<React.SetStateAction<any>>) => {
  setFormData((prev: any) => ({
    ...prev,
    services: prev.services.filter((_: any, i: number) => i !== index),
  }));
};

export const updateService = (
  index: number,
  field: string,
  value: string | number,
  setFormData: React.Dispatch<React.SetStateAction<any>>
) => {
  setFormData((prev: any) => ({
    ...prev,
    services: prev.services.map((service: Service, i: number) =>
      i === index ? { ...service, [field]: value } : service
    ),
  }));
};

export const validateServices = (services: Service[]) => {
  const errors: Record<string, string> = {};
  if (services.length === 0) {
    errors.services = 'At least one service is required';
  } else {
    services.forEach((service, index) => {
      if (!service.name.trim()) {
        errors[`services.${index}.name`] = 'Service name is required';
      }
      if (!service.price || Number(service.price) <= 0) {
        errors[`services.${index}.price`] = 'Valid price is required';
      }
      if (!service.duration || Number(service.duration) < 1) {
        errors[`services.${index}.duration`] = 'Duration must be at least 1 minute';
      }
    });
  }
  return errors;
};

export default { addService, removeService, updateService, validateServices };

