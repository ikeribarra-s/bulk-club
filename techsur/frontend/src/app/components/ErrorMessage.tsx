interface Props {
  message: string;
}

export default function ErrorMessage({ message }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}
