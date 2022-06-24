import { Deferrable, deferred, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Deferred, Link, useCatch, useLoaderData, useParams } from "@remix-run/react";
import { ErrorFallback, InvoiceDetailsFallback } from "~/components";
import { getCustomerDetails } from "~/models/customer.server";
import { requireUser } from "~/session.server";
import { currencyFormatter } from "~/utils";

type LoaderData = {
  customerInfo: {
    name: string;
    email: string;
  };
  // 💿 wrap this in the Deferrable generic (from @remix-run/node) to this:
  invoiceDetails: Deferrable<NonNullable<
    Awaited<ReturnType<typeof getCustomerDetails>>
  >["invoiceDetails"]>;
};

async function getCustomerInfo(customerId: string) {
  const customer = await getCustomerDetails(customerId);
  if (!customer) return null;
  return { name: customer.name, email: customer.email };
}

async function getCustomerInvoiceDetails(customerId: string) {
  const customerDetails = await getCustomerDetails(customerId);
  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * 3000 + 1500)
  );
  return customerDetails?.invoiceDetails ?? [];
}

export const loader: LoaderFunction = async ({ request, params }) => {
  await requireUser(request);
  const { customerId } = params;
  if (typeof customerId !== "string") {
    throw new Error("This should be unpossible.");
  }
  // 💿 The invoiceDetails are slow, so let's defer that.
  // 💿 Change this from a Promise.all to two separate calls
  const customerInfo = await getCustomerInfo(customerId);

  const invoiceDetailsPromise = getCustomerInvoiceDetails(customerId);
  // 💿 Await the customer info, and not the invoice details.
  // const [customerInfo, invoiceDetails] = await Promise.all([
  //   getCustomerInfo(customerId),
  //   getCustomerInvoiceDetails(customerId),
  // ]);
  if (!customerInfo) {
    throw new Response("not found", { status: 404 });
  }
  // 💿 change this from json to deferred (from @remix-run/node)
  return deferred<LoaderData>({
    customerInfo,
    invoiceDetails: invoiceDetailsPromise,
  },);
};

const lineItemClassName = "border-t border-gray-100 text-[14px] h-[56px]";

export default function CustomerRoute() {
  const data = useLoaderData() as LoaderData;

  return (
    <div className="relative p-10">
      <div className="text-[length:14px] font-bold leading-6">
        {data.customerInfo.email}
      </div>
      <div className="text-[length:32px] font-bold leading-[40px]">
        {data.customerInfo.name}
      </div>
      <div className="h-4" />
      <div className="text-m-h3 font-bold leading-8">Invoices</div>
      <div className="h-4" />
      {/*
        💿 Wrap this in a <Deferred /> component with:
        - value as data.invoiceDetails
        - fallback as <InvoiceDetailsFallback /> (imported from "~/components")
      */}
      <Deferred value={data.invoiceDetails} fallback={<InvoiceDetailsFallback />}>
        {(invoiceDetails) => (
          <table className="w-full">
          <tbody>
            {invoiceDetails.map((details) => (
              <tr key={details.id} className={lineItemClassName}>
                <td>
                  <Link
                    className="text-blue-600 underline"
                    to={`../../invoices/${details.id}`}
                  >
                    {details.number}
                  </Link>
                </td>
                <td
                  className={
                    "text-center uppercase" +
                    " " +
                    (details.dueStatus === "paid"
                      ? "text-green-brand"
                      : details.dueStatus === "overdue"
                      ? "text-red-brand"
                      : "")
                  }
                >
                  {details.dueStatusDisplay}
                </td>
                <td className="text-right">
                  {currencyFormatter.format(details.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </Deferred>
    </div>
  );
}

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();

  if (caught.status === 404) {
    return (
      <div className="relative h-full">
        <ErrorFallback
          message={`No customer found with the ID of "${params.customerId}"`}
        />
      </div>
    );
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}
